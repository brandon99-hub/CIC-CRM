import { useState } from "react";
import { Mail } from "lucide-react";
import { ConversationList } from "./ConversationList";
import { ChatWindow } from "./ChatWindow";

export function EmailInbox() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  return (
    <div className="flex h-full bg-white relative">
      {/* ── Left: Conversation List ── */}
      <ConversationList
        platform="email"
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
      />

      {/* ── Right: Chat Window / Email Viewer ── */}
      <div className="flex-1 flex flex-col bg-[#f0f4fa]/30 relative overflow-hidden">
        {activeConversationId ? (
          <ChatWindow conversationId={activeConversationId} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-gray-100 flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-rose-500/40" />
              </div>
              <h3 className="text-xl font-black text-gray-800">Select an Email</h3>
              <p className="text-sm text-gray-500 mt-2 font-medium max-w-[250px] mx-auto leading-relaxed">
                Choose an email from the list to view the thread and respond.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
