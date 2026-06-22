import { db } from "./db";
import { conversations, messages } from "../shared/commsSchema";

async function main() {
  console.log("Injecting mock emails...");

  try {
    const addresses = ["certificates@kasneb.co.ke", "info@kasneb.co.ke", "privacy@kasneb.co.ke"];
    const senders = ["john.doe@gmail.com", "jane.smith@yahoo.com", "alice.williams@company.com"];

    for (let i = 0; i < 3; i++) {
      const [convo] = await db.insert(conversations).values({
        channel: "email",
        externalConversationId: `mock-email-thread-${Date.now()}-${i}`,
        status: "new",
        metadata: {
          toEmail: addresses[i],
          senderName: senders[i].split('@')[0].replace('.', ' '),
          senderEmail: senders[i],
          subject: `Inquiry regarding ${addresses[i].split('@')[0]}`
        }
      }).returning();

      await db.insert(messages).values({
        conversationId: convo.id,
        direction: "inbound",
        contentType: "text",
        body: `Hello,\n\nI have a question regarding the ${addresses[i].split('@')[0]} process. Please let me know the requirements.\n\nThanks,\n${senders[i].split('@')[0]}`,
        externalMessageId: `mock-msg-${Date.now()}-${i}`
      });
      
      console.log(`Injected mock email to ${addresses[i]}`);
    }

    console.log("Mock emails injected successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Failed to inject mock emails:", error);
    process.exit(1);
  }
}

main();
