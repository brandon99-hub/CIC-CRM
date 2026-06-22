import { Router } from "express";
import { db } from "../db";
import { cases, stakeholders } from "../../shared/crmSchema";
import { serviceCategories } from "../../shared/adminSchema";
import { eq } from "drizzle-orm";
import axios from "axios";

export const aiRouter = Router();

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";

// A generic utility function for calling Claude
export async function callClaude(prompt: string, systemPrompt?: string, maxTokens: number = 1024, temperature: number = 0.5): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("Claude API key missing. Falling back...");
    throw new Error("Missing API Key");
  }

  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: CLAUDE_MODEL, // Fast and effective for routing
        max_tokens: maxTokens,
        temperature: temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
      }
    );
    return response.data.content[0].text;
  } catch (error) {
    console.error("Claude API Error:", error);
    throw error;
  }
}

/**
 * Intelligent Case Routing
 * Determines the category of a case based on subject and description.
 */
export async function determineCaseCategory(subject: string, description: string): Promise<{ categoryName: string, confidenceScore: number, isAi: boolean }> {
  try {
    const categories = await db.select().from(serviceCategories).where(eq(serviceCategories.isActive, true));
    const validCategoryNames = categories.map(c => c.name);
    
    const fullCategoryList = validCategoryNames.join(", ");

    const systemPrompt = `You are an intelligent case routing assistant for CIC Insurance Group CRM.
You must analyze the incoming case Subject and Description and classify it into EXACTLY ONE of these categories: [${fullCategoryList}].
Return ONLY a JSON object with two fields: "category" (the exact string match) and "confidence" (a number between 0 and 100).
Do not return any other text.`;

    const truncatedDescription = description.substring(0, 1000);
    const prompt = `Subject: ${subject}\nDescription: ${truncatedDescription}`;

    const aiResponse = await callClaude(prompt, systemPrompt, 100, 0);
    
    // Extract JSON in case Claude includes conversational filler
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : aiResponse;
    const parsed = JSON.parse(jsonStr);

    if (parsed.category && typeof parsed.confidence === "number") {
      if (validCategoryNames.includes(parsed.category)) {
        return {
          categoryName: parsed.category,
          confidenceScore: parsed.confidence,
          isAi: true
        };
      } else {
        console.warn(`Claude returned invalid category: ${parsed.category}`);
      }
    }
  } catch (err) {
    console.error("AI routing failed or not configured, falling back to triage.", err);
  }

  // Fallback to Triage
  return { categoryName: "General Inquiry", confidenceScore: 0, isAi: false };
}

/**
 * AI Message Screener
 * Determines intent of an inbound message and whether to create an intake signal.
 * Returns an auto-reply suggestion for conversational messages.
 */
export async function screenInboundMessage(
  text: string,
  channel: string,
  conversationHistory: string[] = []
): Promise<{
  intent: "greeting" | "inquiry" | "complaint" | "request" | "other";
  shouldCreateSignal: boolean;
  suggestedCategory: string | null;
  confidence: number;
  suggestedAutoReply: string | null;
}> {
  try {
    const categories = await db.select({ name: serviceCategories.name })
      .from(serviceCategories)
      .where(eq(serviceCategories.isActive, true));
    const categoryNames = categories.map(c => c.name);
    const categoryList = categoryNames.join(", ");

    const systemPrompt = `You are an intelligent message screener for CIC Insurance Group — Kenya's leading cooperative-based insurer.
CIC Insurance handles: Motor insurance, Life assurance, Medical/health insurance, Property insurance, Marine insurance, Pension schemes, Group life and credit life schemes for SACCOs and corporates, Micro-insurance products, Bancassurance solutions.

Service categories available: [${categoryList}]

Analyze the inbound message and respond ONLY with a valid JSON object. No extra text.

{
  "intent": "greeting" | "inquiry" | "complaint" | "request" | "other",
  "shouldCreateSignal": true | false,
  "suggestedCategory": "exact category name from list or null",
  "confidence": 0-100,
  "suggestedAutoReply": "warm professional reply text or null"
}

Classification rules:
- "greeting": hi, hello, good morning, hey, thanks, ok, bye, 👋, emojis only → shouldCreateSignal=false, confidence=99, provide friendly autoReply ending with "How can we help you today?"
- "inquiry": general questions about premiums, cover types, eligibility, claims process, policy details → shouldCreateSignal=false, confidence=60-80, autoReply=null (agent will answer)
- "complaint": claim rejected, wrong amount, delayed payout, policy lapsed unexpectedly, bad service → shouldCreateSignal=true, confidence=70-95, suggestedCategory from list
- "request": want to renew, make a claim, amend policy, request certificate, enroll in scheme → shouldCreateSignal=true, confidence=70-90, suggestedCategory from list
- "other": unclear, very short, ambiguous → shouldCreateSignal=true (safe default), confidence=30

Auto-reply template for greetings:
WhatsApp: "Hello! 👋 Welcome to CIC Insurance Group. We're here to assist you with Motor, Life, Medical, Property, Marine insurance, and SACCO/corporate group schemes. How can we help you today?"
Facebook/Instagram: "Hi there! Thank you for reaching out to CIC Insurance Group. How can we assist you today?"`;


    const contextStr = conversationHistory.length > 0
      ? `Conversation history:\n${conversationHistory.slice(-3).join('\n')}\n\n`
      : '';
    const prompt = `${contextStr}Channel: ${channel}\nMessage: "${text.substring(0, 500)}"`;

    const raw = await callClaude(prompt, systemPrompt, 350, 0);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate suggestedCategory is actually in our list
    const validCategory = parsed.suggestedCategory && categoryNames.includes(parsed.suggestedCategory)
      ? parsed.suggestedCategory
      : null;

    return {
      intent: ["greeting", "inquiry", "complaint", "request", "other"].includes(parsed.intent)
        ? parsed.intent
        : "other",
      shouldCreateSignal: typeof parsed.shouldCreateSignal === "boolean"
        ? parsed.shouldCreateSignal
        : true,
      suggestedCategory: validCategory,
      confidence: typeof parsed.confidence === "number"
        ? Math.min(100, Math.max(0, parsed.confidence))
        : 0,
      suggestedAutoReply: typeof parsed.suggestedAutoReply === "string" && parsed.suggestedAutoReply.length > 0
        ? parsed.suggestedAutoReply
        : null,
    };
  } catch (err) {
    console.error("[AI Screener] Failed, falling back to human review:", err);
    // Safe fallback: create signal for human review, no auto-reply
    return {
      intent: "other",
      shouldCreateSignal: true,
      suggestedCategory: null,
      confidence: 0,
      suggestedAutoReply: null,
    };
  }
}

aiRouter.post("/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: "Invalid message" });
    }
    
    const truncatedMessage = message.substring(0, 500);
    
    // Context injection: we can add DB context here later
    // Basic AI response using Claude
    const systemPrompt = `You are a helpful AI assistant for the CIC Insurance Group CRM system.
You help CIC staff and distribution partners with CRM navigation, client management, and understanding CIC Insurance processes including:
- Policy onboarding, amendments, and renewal workflows
- Motor, Life, Medical, Property, Marine, and SACCO group scheme management
- Claims lodgement, tracking, and dispute resolution
- Agent and broker partner management
- Premium payment processing and M-PESA reconciliation
- SACCO and corporate scheme client relationship management
Keep responses concise, professional, and tailored to insurance operations in Kenya.`;

    const recentHistory = Array.isArray(history) ? history.slice(-5) : [];
    const formattedHistory = recentHistory.map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join("\n");
    const prompt = `${formattedHistory}\nUser: ${truncatedMessage}\nAssistant:`;

    const reply = await callClaude(prompt, systemPrompt, 500, 0.5);
    res.json({ reply });
  } catch (err) {
    console.error("Chatbot Error:", err);
    res.status(500).json({ error: "Failed to process chat" });
  }
});
