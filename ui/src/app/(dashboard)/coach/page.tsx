"use client";

import { useState } from "react";

const PREVIEW_BANNER = (
  <div className="mb-5 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
    <span><strong>Preview</strong> — AI Financial Coach is a planned feature. Responses shown are illustrative.</span>
  </div>
);

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
  "What would happen if I cut dining by 20%?",
  "Show me my spending trend for the last 6 months",
];

const MONTHLY_NARRATIVE = `**May was your best month financially in 2026.** You spent $3,847 — $290 less than April. Dining out dropped 22% after your budget nudge mid-month. Your savings rate hit 21%, crossing the 20% threshold for the first time this year.

Watch out for: Shopping crept up to $340 (13% over budget). You also have 3 subscriptions renewing in June totaling $48.97. Consider reviewing before the charges land.

One win worth noting: you haven't touched your Japan fund since March, but your automatic $200 transfer kept running quietly. You're now 40% of the way there.`;

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>(STARTER_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "narrative">("chat");

  function handleChip(q: string) {
    const qa = SAMPLE_QA.find((x) => x.q === q);
    if (!qa) {
      setMessages((m) => [
        ...m,
        { role: "user", text: q },
        { role: "coach", text: "Great question! In the live version, I'd pull your real transaction data to answer this accurately. For now, this is a preview of what the conversation would look like." },
      ]);
      return;
    }
    setMessages((m) => [...m, { role: "user", text: q }]);
    setIsTyping(true);
    setTimeout(() => {
      setMessages((m) => [...m, { role: "coach", text: qa.a }]);
      setIsTyping(false);
    }, 900);
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
        {
          role: "coach",
          text: "In the live version, I'd search your transactions and give you a precise answer. This is a preview of the chat interface.",
        },
      ]);
      setIsTyping(false);
    }, 800);
  }

  function renderText(text: string) {
    return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  return (
    <div className="space-y-5">
      {PREVIEW_BANNER}

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-[var(--radius-sm)] bg-surface-raised p-1">
        {(["chat", "narrative"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-[var(--radius-sm)] py-1.5 text-sm font-semibold capitalize transition-all ${
              activeTab === tab ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
            }`}
          >
            {tab === "chat" ? "Ask Coach" : "Monthly Narrative"}
          </button>
        ))}
      </div>

      {activeTab === "chat" && (
        <div className="flex flex-col gap-4">
          {/* Messages */}
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "coach" && (
                  <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold" style={{ background: "var(--gradient-hero)" }}>
                    SF
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-[var(--radius-md)] px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "text-white"
                      : "bg-surface border border-border text-text"
                  }`}
                  style={m.role === "user" ? { background: "var(--gradient-hero)" } : {}}
                  dangerouslySetInnerHTML={{ __html: renderText(m.text) }}
                />
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold" style={{ background: "var(--gradient-hero)" }}>
                  SF
                </div>
                <div className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick chips */}
          <div className="flex flex-wrap gap-2">
            {CHIP_LABELS.slice(0, 3).map((label) => (
              <button
                key={label}
                onClick={() => handleChip(label)}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text transition hover:border-primary hover:text-primary"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask me anything about your finances..."
              className="flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleSend}
              className="rounded-[var(--radius-md)] px-4 py-2.5 text-sm font-semibold text-white transition"
              style={{ background: "var(--gradient-hero)" }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {activeTab === "narrative" && (
        <div className="space-y-4">
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold" style={{ background: "var(--gradient-hero)" }}>
                SF
              </div>
              <div>
                <p className="text-sm font-semibold text-text">Your May 2026 Summary</p>
                <p className="text-xs text-text-muted">Generated by SpendFlow AI</p>
              </div>
            </div>
            <div
              className="text-sm leading-relaxed text-text space-y-3"
              dangerouslySetInnerHTML={{
                __html: MONTHLY_NARRATIVE.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n\n/g, "</p><p>"),
              }}
            />
          </div>

          {/* Predictive */}
          <div className="rounded-[var(--radius-md)] border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">30-day forecast</p>
            <p className="text-sm text-text">
              Based on your patterns, you'll likely spend <strong>$3,600–$3,950</strong> in June. Big events: annual Adobe renewal ($660), Japan fund transfer ($200), and your typical summer dining uptick. Savings rate projected at <strong>18–21%</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
