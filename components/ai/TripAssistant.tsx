"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { RouteAnalysisResult } from "@/types/vignette";
import { buildRouteContext, buildRouteSummaryOneLiner } from "@/lib/ai/contextBuilder";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface TripAssistantProps {
  routeResult?: RouteAnalysisResult | null;
  isOpen: boolean;
  onClose: () => void;
}

let messageIdCounter = 0;
function nextId(): string {
  return `msg-${++messageIdCounter}-${Date.now()}`;
}

export const TripAssistant = memo(function TripAssistant({
  routeResult,
  isOpen,
  onClose,
}: TripAssistantProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);

  const routeContext = routeResult ? buildRouteContext(routeResult) : "";
  const routeSummary = routeResult ? buildRouteSummaryOneLiner(routeResult) : "";

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const resp = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: "ping" }],
          }),
        });
        if (!cancelled) {
          setAiAvailable(resp.status !== 503);
        }
      } catch {
        if (!cancelled) setAiAvailable(false);
      }
    }
    if (isOpen && aiAvailable === null) {
      check();
    }
    return () => { cancelled = true; };
  }, [isOpen, aiAvailable]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = { id: nextId(), role: "user", content: text.trim() };
    const assistantMsg: ChatMessage = { id: nextId(), role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setError(null);
    setLastFailedText(null);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const allMsgs = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const resp = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMsgs,
          routeContext,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${resp.status})`);
      }

      if (!resp.body) {
        throw new Error("No response stream");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });

        const snapshot = accumulated;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: snapshot } : m,
          ),
        );
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const errMsg = err instanceof Error ? err.message : "Something went wrong";
      setError(errMsg);
      setLastFailedText(text.trim());

      setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id || m.content.length > 0));
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isStreaming, messages, routeContext]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  }, [input, sendMessage]);

  const handleRetry = useCallback(() => {
    if (lastFailedText) {
      sendMessage(lastFailedText);
    }
  }, [lastFailedText, sendMessage]);

  const handleClearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setLastFailedText(null);
  }, []);

  const suggestions = routeResult
    ? [
        "What vignettes do I need?",
        "Border crossing tips?",
        "How can I save on tolls?",
        "Summarize my trip costs",
      ]
    : [
        "Plan a trip Munich to Split",
        "Austria vignette rules?",
        "Which countries have e-vignettes?",
        "Tips for driving in Croatia",
      ];

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9998] bg-black/20 transition-opacity"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Side drawer */}
      <aside
        className={`fixed top-0 right-0 z-[10000] flex h-full w-[420px] max-w-[calc(100vw-1rem)] flex-col border-l border-[var(--border)] bg-surface shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="AI Trip Assistant"
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-surface-muted px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-[var(--text-primary)]">Trip Assistant</h3>
              {routeSummary && (
                <p className="max-w-[240px] truncate text-[10px] text-[var(--text-muted)]">{routeSummary}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearChat}
              className="rounded p-1.5 text-[var(--text-muted)] transition-colors hover:bg-surface hover:text-[var(--text-primary)]"
              title="Clear chat"
              aria-label="Clear chat history"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1.5 text-[var(--text-muted)] transition-colors hover:bg-surface hover:text-[var(--text-primary)]"
              title="Close (Esc)"
              aria-label="Close chat panel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {aiAvailable === false && (
            <div className="rounded-lg border border-[var(--accent)]/20 bg-[#FDF6EC] p-3 text-xs text-[var(--text-secondary)]">
              <p className="font-semibold">AI assistant not available</p>
              <p className="mt-1">
                Make sure LM Studio is running and <code className="rounded bg-[var(--accent)]/10 px-1">AI_ENABLED=true</code>{" "}
                is set in your <code className="rounded bg-[var(--accent)]/10 px-1">.env</code> file.
              </p>
            </div>
          )}

          {messages.length === 0 && aiAvailable !== false && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
                <span className="text-2xl">🗺️</span>
              </div>
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                {routeResult
                  ? "I have your route data. Ask me anything about your trip!"
                  : "Ask me about European road trips, vignettes, and tolls."}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => sendMessage(suggestion)}
                    className="rounded-full border border-[var(--border)] bg-surface px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:bg-[#FDF6EC] hover:text-[var(--accent)]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`mb-3 ${message.role === "user" ? "flex justify-end" : "flex justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-surface-muted text-[var(--text-primary)]"
                }`}
              >
                {message.role === "assistant" && message.content === "" && isStreaming ? (
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--text-muted)]" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--text-muted)]" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--text-muted)]" style={{ animationDelay: "300ms" }} />
                  </div>
                ) : message.role === "assistant" ? (
                  <div className="chat-markdown prose prose-sm max-w-none">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <span>{message.content}</span>
                )}
              </div>
            </div>
          ))}

          {error && (
            <div className="mb-3 rounded-lg border border-[var(--accent-red)]/20 bg-[#FDF2F0] p-2 text-xs text-[var(--accent-red)]" role="alert">
              <p>{error}</p>
              {lastFailedText && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isStreaming}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[var(--accent-red)]/10 px-2.5 py-1 text-xs font-medium text-[var(--accent-red)] transition-colors hover:bg-[var(--accent-red)]/20 disabled:opacity-50"
                  aria-label="Retry last message"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
                  </svg>
                  Retry
                </button>
              )}
            </div>
          )}
        </div>

        {/* Input area */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t border-[var(--border)] bg-surface-muted px-4 py-3"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={aiAvailable === false ? "AI not available\u2026" : "Ask about your trip\u2026"}
            disabled={aiAvailable === false || isStreaming}
            className="flex-1 rounded-lg border border-[var(--border)] bg-surface px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 disabled:opacity-50"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming || aiAvailable === false}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-40"
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
            </svg>
          </button>
        </form>
      </aside>
    </>
  );
});
