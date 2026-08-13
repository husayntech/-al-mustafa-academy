import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, X, Send, Sparkles, School, User, ArrowRight } from "lucide-react";
import { ChatMessage } from "../types";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "As-salamu alaykum. Welcome to Al Mustafa Academy Support Panel! I am Al Mustafa, your academic AI scholar. How may I guide you on your journey of tradition and excellence today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const quickReplies = [
    { label: "Tuition Details", query: "What are the tuition and fees at Al Mustafa Academy?" },
    { label: "Required Docs", query: "What are the required documents for admissions enrollment?" },
    { label: "Sacred Mission", query: "What is Al Mustafa Academy's Sacred Mission?" },
    { label: "Madrasah Activities", query: "What does a typical day at Al Mustafa Academy look like?" },
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) {
        throw new Error("Failed to connect to assistant service.");
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: Math.random().toString(),
        role: "assistant",
        content: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: Math.random().toString(),
        role: "assistant",
        content: "I apologize, but I am experiencing difficulty connecting to our server at the moment. Please feel free to email almustafaacademyilorin@gmail.com directly.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        id="chatbot-fab"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-white rounded-full shadow-2xl flex items-center justify-center z-40 cursor-pointer transition-all hover:scale-110 active:scale-90"
        title="Open Academy Chat"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Floating Chat Overlay and Pane */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/40 z-50 backdrop-blur-xs cursor-pointer"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: "100%", opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-surface z-[55] shadow-2xl flex flex-col border-l border-primary/10 overflow-hidden"
            >
              {/* Header */}
              <div className="bg-primary text-on-primary py-5 px-6 flex items-center justify-between border-b border-secondary/20 relative">
                <div className="absolute inset-0 bg-radial-gradient(circle, rgba(115,92,0,0.1) 0%, transparent 100%) pointer-events-none" />
                <div className="flex items-center gap-3 relative z-10 animate-fade-in">
                  <div className="bg-secondary-fixed text-on-secondary-fixed p-2 rounded-lg">
                    <School className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h2 className="font-serif font-semibold text-lg max-sm:text-md tracking-tight">Al Mustafa Scholar</h2>
                    <p className="font-sans text-xs opacity-85 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-secondary-fixed animate-pulse" /> Academy AI Assistant
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-background">
                <div className="neo-islamic-pattern absolute inset-0 pointer-events-none opacity-[0.03]" />
                
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3 ${
                      m.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {/* Character/User Icon */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs ${
                        m.role === "user"
                          ? "bg-secondary-container text-on-secondary-container"
                          : "bg-primary text-white border border-secondary/20"
                      }`}
                    >
                      {m.role === "user" ? <User className="w-4 h-4" /> : <School className="w-4 h-4 text-secondary" />}
                    </div>

                    {/* Speech Bubble */}
                    <div
                      className={`max-w-[78%] px-4 py-3 rounded-lg shadow-xs text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-secondary-container text-on-secondary-container rounded-tr-none font-medium"
                          : "bg-white text-on-surface border border-primary/5 rounded-tl-none"
                      }`}
                    >
                      <div className="whitespace-pre-line prose prose-sm max-w-none">
                        {m.content}
                      </div>
                      <span className={`block text-[10px] mt-1 text-right ${
                        m.role === "user" ? "text-on-secondary-container/75" : "text-on-surface-variant/60"
                      }`}>
                        {m.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center border border-secondary/20">
                      <School className="w-4 h-4 text-secondary" />
                    </div>
                    <div className="bg-white border border-primary/5 px-4 py-3 rounded-lg rounded-tl-none shadow-xs">
                      <div className="flex gap-1 items-center h-4">
                        <span className="w-2 h-2 bg-secondary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-2 h-2 bg-secondary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 bg-secondary rounded-full animate-bounce"></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>

              {/* Quick Suggestion Chips */}
              {messages.length < 3 && !isLoading && (
                <div className="px-6 py-2 bg-background border-t border-primary/5 flex gap-2 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {quickReplies.map((qr) => (
                    <button
                      key={qr.label}
                      onClick={() => handleSend(qr.query)}
                      className="text-xs bg-white border border-primary/10 hover:border-secondary hover:bg-surface-container-low text-primary px-3 py-1.5 rounded-full whitespace-nowrap cursor-pointer transition-all hover:scale-102 flex items-center gap-1 shrink-0"
                    >
                      {qr.label} <ArrowRight className="w-3 h-3 text-secondary" />
                    </button>
                  ))}
                </div>
              )}

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend(input);
                }}
                className="p-4 bg-white border-t border-primary/10 flex gap-2 items-center shrink-0"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question about admissions, tuition..."
                  className="flex-1 bg-surface border border-primary/20 p-3 text-sm rounded focus:outline-none focus:border-secondary transition-colors"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="bg-primary hover:bg-primary-container text-white p-3 rounded hover:scale-105 active:scale-95 transition-all outline-none disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4 text-secondary-fixed" />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
