"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check, Loader2, Send, Square } from "lucide-react";
import { MarkdownContent } from "@/components/chat/markdown-content";
import { cn, formatTokenCount } from "@/lib/utils";

interface Message {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
}

interface ChatInterfaceProps {
  chatId: string;
  initialMessages: Message[];
  tokenBalance: number;
}

export function ChatInterface({
  chatId,
  initialMessages,
  tokenBalance: initialBalance,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState("");
  const [tokenBalance, setTokenBalance] = useState(initialBalance);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setError("");
    setStreaming(true);
    setStreamingContent("");

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "USER",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message: text }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              accumulated += data.content;
              setStreamingContent(accumulated);
            }
            if (data.done) {
              setTokenBalance(data.balance ?? tokenBalance);
            }
            if (data.error) {
              setError(data.error);
            }
          } catch {
            // skip malformed
          }
        }
      }

      if (accumulated) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "ASSISTANT",
            content: accumulated,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setStreaming(false);
      setStreamingContent("");
      abortRef.current = null;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setStreaming(false);
    setStreamingContent("");
  }

  async function handleCopy(content: string, id: string) {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span>{formatTokenCount(tokenBalance)} tokens remaining</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && !streaming && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <h2 className="text-xl font-semibold">Erasmus AI Assistant</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Ask about Erasmus+ rules, write project descriptions, check
              compliance, or get help with your grant application.
            </p>
          </div>
        )}

        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "group flex gap-3",
                message.role === "USER" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "relative max-w-[85%] rounded-2xl px-4 py-3",
                  message.role === "USER"
                    ? "bg-accent text-accent-foreground"
                    : "bg-card border border-border",
                )}
              >
                {message.role === "ASSISTANT" ? (
                  <MarkdownContent content={message.content} />
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                )}
                <button
                  type="button"
                  onClick={() => handleCopy(message.content, message.id)}
                  className="absolute -bottom-2 right-2 rounded-md bg-background p-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                  aria-label="Copy message"
                >
                  {copiedId === message.id ? (
                    <Check className="h-3 w-3 text-accent" />
                  ) : (
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          ))}

          {streaming && streamingContent && (
            <div className="flex gap-3">
              <div className="max-w-[85%] rounded-2xl border border-border bg-card px-4 py-3">
                <MarkdownContent content={streamingContent} />
              </div>
            </div>
          )}

          {streaming && !streamingContent && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="border-t border-border p-4">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask about Erasmus+ applications..."
            rows={1}
            disabled={streaming}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none ring-ring focus:ring-2 disabled:opacity-50"
          />
          {streaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-muted"
              aria-label="Stop generation"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
