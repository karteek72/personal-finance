"use client";

import { useState } from "react";

type Message = { role: "user" | "coach"; text: string };

const STARTER_MESSAGES: Message[] = [
  {
    role: "coach",
    text: "Hi! I'm your SpendFlow coach. I have full visibility into your transactions, budgets, and goals. Ask me anything — or pick a quick question below.",
  },
];

const SAMPLE_QA: { q: string; a: string }[] = [
  {
    q: "How much did I spend on food delivery last month?",
    a: "Last month you spent **$312** on food delivery across 18 orders — DoorDash ($189), Uber Eats ($97), and Grubhub ($26). That's **+41% vs. your 3-month average of $221**. Your peak ordering days were Thursdays and Sundays. Want me to set a food delivery budget?",
  },
  {
    q: "Am I on track to hit my emergency fund goal?",
    a: "Your emergency fund goal is $10,000 by December 2026. You're at **$6,420 (64.2%)** with 7 months left. At your current savings pace of $380/month, you'll hit **$9,070 by December** — about $930 short. To hit the goal exactly, you'd need to save **$511/month**. Want me to find where you could cut to close that gap?",
  },
  {
    q: "What's my biggest wasted expense?",
    a: "Looking at your last 3 months, your Adobe Creative Cloud subscription at **$54.99/month** hasn't had any associated file activity I can detect. You're also paying for **Hulu + Disney+ simultaneously** — you binge one heavily, the other has zero activity this quarter. That's **$32/month or $384/year** you could reclaim.",
  },
];

const CHIP_LABELS = [
  "How much did I spend on food delivery last month?",
  "Am I on track to hit my emergency fund goal?",
  "What's my biggest wasted expense?",
];

const MONTHLY_NARRATIVE = `**May was your best month financially in 2026.** You spent $3,847 — $290 less than April. Dining out dropped 22% after your budget nudge mid-month. Your savings rate hit 21%, crossing the 20% threshold for the first time this year.

Watch out for: Shopping crept up to $340 (13% over budget). You also have 3 subscriptions renewing in June totaling $48.97. Consider reviewing before the charges land.

One win worth noting: you haven't touched your Japan fund since March, but your automatic $200 transfer kept running quietly. You're now 40% of the way there.`;

function renderText(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function CoachAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(STARTER_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "narrative">("chat");

  function handleChip(q: string) {
    const qa = SAMPLE_QA.find((x) => x.q === q);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setIsTyping(true);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          role: "coach",
          text:
            qa?.a ??
            "Great question! In the live version, I'd pull your real transaction data to answer this accurately. For now, this is a preview of what the conversation would look like.",
        },
      ]);
      setIsTyping(false);
    }, 800);
  }

  function handleSend() {
    if (!input.trim()) return;
    const q = input;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setIsTyping(true);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { role: "coach", text: "In the live version, I'd search your transactions and give you a precise answer. This is a preview of the chat interface." },
      ]);
      setIsTyping(false);
    }, 800);
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
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">Preview · illustrative responses</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-[var(--radius-sm)] p-1.5 text-text-muted hover:bg-surface-raised hover:text-text" aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
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
                    <p className="text-sm text-text">
                      Based on your patterns, you&apos;ll likely spend <strong>$3,600–$3,950</strong> in June. Big events: annual Adobe renewal ($660), Japan fund transfer ($200), and your typical summer dining uptick. Savings rate projected at <strong>18–21%</strong>.
                    </p>
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
