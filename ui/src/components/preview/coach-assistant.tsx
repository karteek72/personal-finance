"use client";

import { useState } from "react";

import { useHasActiveAccounts } from "@/hooks/use-has-active-accounts";
import { MetricLiveBadge } from "@/components/ui/metric-live-badge";
import { api } from "@/lib/api-client";
import { useCoach } from "@/hooks/use-features";

type Message = { role: "user" | "coach"; text: string };

const STARTER_MESSAGES: Message[] = [
  {
    role: "coach",
    text: "Hi! I'm your SpendFlow coach. I have full visibility into your transactions, budgets, and goals. Ask me anything — or pick a quick question below.",
  },
];

function renderText(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function CoachAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(STARTER_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [coachIsLive, setCoachIsLive] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "narrative">("chat");
  const { hasAccounts } = useHasActiveAccounts();
  const { data } = useCoach();

  const SAMPLE_QA = data?.qa ?? [];
  const CHIP_LABELS = SAMPLE_QA.map((x) => x.q);
  const MONTHLY_NARRATIVE =
    data?.narrative ??
    (hasAccounts
      ? "Connect transactions and sync accounts to generate your monthly narrative."
      : "Connect accounts to unlock coach insights.");
  const FORECAST =
    data?.forecast ??
    (hasAccounts
      ? "Forecast will appear once enough cash-flow history is available."
      : "");

  function handleChip(q: string) {
    const qa = SAMPLE_QA.find((x) => x.q === q);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setIsTyping(true);
    void api
      .askCoach(q)
      .then((res) => {
        setCoachIsLive(res.isLive);
        setMessages((m) => [
          ...m,
          {
            role: "coach",
            text: res.answer,
          },
        ]);
      })
      .catch(() => {
        setMessages((m) => [
          ...m,
          {
            role: "coach",
            text:
              qa?.a ??
              "I couldn't reach the coach service. Try again in a moment.",
          },
        ]);
      })
      .finally(() => setIsTyping(false));
  }

  function handleSend() {
    if (!input.trim()) return;
    const q = input;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setIsTyping(true);
    void api
      .askCoach(q)
      .then((res) => {
        setCoachIsLive(res.isLive);
        setMessages((m) => [...m, { role: "coach", text: res.answer }]);
      })
      .catch(() => {
        setMessages((m) => [
          ...m,
          {
            role: "coach",
            text: "I couldn't reach the coach service. Try again in a moment.",
          },
        ]);
      })
      .finally(() => setIsTyping(false));
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI Coach"
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 md:bottom-6 md:right-6"
        style={{ background: "var(--gradient-hero)" }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
          <path d="M12 3c4.97 0 9 3.58 9 8s-4.03 8-9 8a10 10 0 0 1-3-.45L4 21l.9-3.6A7.4 7.4 0 0 1 3 11c0-4.42 4.03-8 9-8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button aria-label="Close coach" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="animate-fade-in relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--gradient-hero)" }}>
                  SF
                </div>
                <div>
                  <p className="text-sm font-bold text-text">AI Coach</p>
                  <p className="text-[10px] text-text-muted">Ask about your spending, savings, and goals</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MetricLiveBadge isLive={coachIsLive ?? data?.isLive ?? false} />
                <button onClick={() => setOpen(false)} className="rounded-[var(--radius-sm)] p-1.5 text-text-muted hover:bg-surface-raised hover:text-text" aria-label="Close">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border p-2">
              {(["chat", "narrative"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded-[var(--radius-sm)] py-1.5 text-sm font-semibold transition-all ${
                    activeTab === tab ? "bg-surface-raised text-text" : "text-text-muted hover:text-text"
                  }`}
                >
                  {tab === "chat" ? "Ask Coach" : "Monthly Narrative"}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === "chat" ? (
                <div className="space-y-3">
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      {m.role === "coach" && (
                        <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--gradient-hero)" }}>
                          SF
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-[var(--radius-md)] px-3.5 py-2 text-sm leading-relaxed ${
                          m.role === "user" ? "text-white" : "border border-border bg-surface text-text"
                        }`}
                        style={m.role === "user" ? { background: "var(--gradient-hero)" } : {}}
                        // Coach replies are static illustrative strings (safe to format).
                        // User text is rendered as escaped plain text to avoid an XSS sink.
                        {...(m.role === "coach"
                          ? { dangerouslySetInnerHTML: { __html: renderText(m.text) } }
                          : { children: m.text })}
                      />
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--gradient-hero)" }}>
                        SF
                      </div>
                      <div className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" style={{ animationDelay: `${i * 150}ms` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
                    <p className="mb-3 text-sm font-semibold text-text">Your May 2026 Summary</p>
                    <div
                      className="space-y-3 text-sm leading-relaxed text-text"
                      dangerouslySetInnerHTML={{
                        __html: MONTHLY_NARRATIVE.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n\n/g, "</p><p>"),
                      }}
                    />
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-primary/20 bg-primary/5 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">30-day forecast</p>
                    <p
                      className="text-sm text-text"
                      // Forecast text is from our own dataset (not user input); safe to format bold markers.
                      dangerouslySetInnerHTML={{ __html: renderText(FORECAST) }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer (chat only) */}
            {activeTab === "chat" && (
              <div className="space-y-2 border-t border-border p-3">
                <div className="flex flex-wrap gap-2">
                  {CHIP_LABELS.map((label) => (
                    <button
                      key={label}
                      onClick={() => handleChip(label)}
                      className="rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] font-medium text-text transition hover:border-primary hover:text-primary"
                    >
                      {label.length > 34 ? `${label.slice(0, 32)}…` : label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Ask me anything about your finances..."
                    className="flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                  />
                  <button onClick={handleSend} className="rounded-[var(--radius-md)] px-4 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--gradient-hero)" }}>
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
