import React, { useState, useEffect, useRef } from "react";
import { AtSign, User } from "lucide-react";

interface UserMention {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

interface MentionInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    placeholder?: string;
    className?: string;
}

export function MentionInput({ value, onChange, onSend, placeholder, className }: MentionInputProps) {
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [users, setUsers] = useState<UserMention[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (showMentions) {
            const fetchUsers = async () => {
                try {
                    const token = localStorage.getItem("marketingToken");
                    const res = await fetch(`/api/users/search?query=${mentionQuery}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await res.json();
                    setUsers(data.users || []);
                    setSelectedIndex(0);
                } catch (error) {
                    console.error("Error fetching users for mentions:", error);
                }
            };
            const timer = setTimeout(fetchUsers, 200);
            return () => clearTimeout(timer);
        }
    }, [mentionQuery, showMentions]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showMentions) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % users.length);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + users.length) % users.length);
            } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                if (users[selectedIndex]) {
                    insertMention(users[selectedIndex]);
                }
            } else if (e.key === "Escape") {
                setShowMentions(false);
            }
        } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    const insertMention = (user: UserMention) => {
        const cursorPosition = inputRef.current?.selectionStart || 0;
        const textBefore = value.substring(0, cursorPosition).replace(/@\w*$/, "");
        const textAfter = value.substring(cursorPosition);
        const mention = `@${user.firstName} ${user.lastName} `;

        onChange(textBefore + mention + textAfter);
        setShowMentions(false);

        // Set focus back and adjust cursor
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                const newPos = textBefore.length + mention.length;
                inputRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        onChange(newValue);

        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = newValue.substring(0, cursorPosition);
        const lastAt = textBeforeCursor.lastIndexOf("@");

        if (lastAt !== -1 && !textBeforeCursor.substring(lastAt).includes(" ")) {
            setShowMentions(true);
            setMentionQuery(textBeforeCursor.substring(lastAt + 1));
        } else {
            setShowMentions(false);
        }
    };

    return (
        <div className={`relative ${className}`}>
            <textarea
                ref={inputRef}
                value={value}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full p-3 pr-12 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#004E98]/20 focus:border-[#004E98] resize-none min-h-[52px] bg-white transition-all text-sm leading-relaxed"
                rows={1}
            />

            {showMentions && users.length > 0 && (
                <div className="absolute bottom-full left-0 w-64 mb-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in slide-in-from-bottom-2">
                    <div className="p-2 border-b border-gray-50 flex items-center gap-2 bg-gray-50/50">
                        <AtSign className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Mention user</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                        {users.map((user, index) => (
                            <button
                                key={user.id}
                                onClick={() => insertMention(user)}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${index === selectedIndex ? "bg-[#004E98]/5 border-[#004E98]/10" : "hover:bg-gray-50"
                                    }`}
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                                    <User className="w-4 h-4 text-[#004E98]" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-semibold text-gray-900 truncate">
                                        {user.firstName} {user.lastName}
                                    </span>
                                    <span className="text-xs text-gray-500 truncate">{user.email}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
