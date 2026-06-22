import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, User, Loader2, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AiChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm your CIC AI Assistant. Ask me about general CRM FAQs or specific cases!" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();

  const isLoginPage = location === "/marketing/login" || location === "/marketing/reset-password";

  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest("/api/auth/me").then(r => r.json()),
    staleTime: 1000 * 60 * 5,
    retry: false,
    enabled: !isLoginPage, // Don't fetch auth state if we're explicitly on the login page
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    document.addEventListener("toggle-ai-chatbot", handleToggle);
    return () => document.removeEventListener("toggle-ai-chatbot", handleToggle);
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history: messages })
      });
      
      if (!response.ok) throw new Error("Failed to get response");
      
      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I'm having trouble connecting right now." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoginPage || !me) return null;

  return (
    <>
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-2rem)] shadow-2xl z-50 flex flex-col border-gray-200 rounded-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          <CardHeader className="bg-[#004E98] text-white p-4 flex flex-row items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle className="text-sm font-bold tracking-wide uppercase">CIC AI Assistant</CardTitle>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 hover:text-white rounded-full" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden bg-gray-50/50">
            <ScrollArea className="h-full p-4" ref={scrollRef}>
              <div className="flex flex-col gap-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${msg.role === "user" ? "bg-[#004E98] text-white rounded-tr-sm" : "bg-white border border-gray-100 shadow-sm text-gray-800 rounded-tl-sm"}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-100 shadow-sm text-gray-800 rounded-2xl rounded-tl-sm p-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#004E98]" />
                      <span className="text-xs font-medium text-gray-500">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="p-3 bg-white border-t border-gray-100">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex w-full gap-2">
              <Input
                placeholder="Ask about a case or FAQ..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 border-gray-200 rounded-xl focus-visible:ring-[#004E98]/20"
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="bg-[#004E98] hover:bg-[#003B73] rounded-xl shadow-sm">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </>
  );
}
