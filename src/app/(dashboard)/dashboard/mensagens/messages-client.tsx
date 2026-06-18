"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { PageTitle } from "@/components/dashboard/primitives";
import { sendMessage } from "@/lib/data/actions";
import type { Conversation } from "@/lib/data/messages";
import { cn } from "@/lib/utils";

export function MessagesClient({ initial }: { initial: Conversation[] }) {
  const [conversations, setConversations] = useState<Conversation[]>(initial);
  const [activeId, setActiveId] = useState<string>(initial[0]?.id ?? "");
  const [draft, setDraft] = useState("");

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !active) return;
    const text = draft;
    setDraft("");
    // Atualização otimista
    setConversations((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? { ...c, preview: text, messages: [...c.messages, { id: `tmp-${Date.now()}`, from: "me", text }] }
          : c
      )
    );
    // Persiste (Supabase quando configurado; no-op em demo)
    await sendMessage({
      conversationId: active.id,
      receiverId: active.otherId,
      propertyId: active.propertyId,
      body: text,
    });
  }

  if (!active) {
    return (
      <>
        <PageTitle title="Mensagens" />
        <p className="rounded-2xl border border-dashed border-line bg-white p-12 text-center text-muted">
          Nenhuma conversa ainda.
        </p>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Mensagens" />
      <div className="grid h-[70vh] overflow-hidden rounded-2xl border border-sage-200 bg-white md:grid-cols-3">
        {/* Lista */}
        <aside className="border-r border-sage-200 md:col-span-1">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 border-b border-sage-200 px-4 py-3 text-left transition-colors",
                active.id === c.id ? "bg-blue-50" : "hover:bg-surface-2"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-medium text-ink">{c.name}</span>
                <span className="text-xs text-muted">{c.property}</span>
              </div>
              <span className="line-clamp-1 text-sm text-muted">{c.preview}</span>
            </button>
          ))}
        </aside>

        {/* Chat */}
        <section className="flex flex-col md:col-span-2">
          <header className="border-b border-sage-200 px-5 py-3">
            <p className="font-medium text-ink">{active.name}</p>
            {active.property && <p className="text-xs text-muted">Sobre: {active.property}</p>}
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-surface-2 p-5">
            {active.messages.map((m) => (
              <div key={m.id} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
                <span
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                    m.from === "me"
                      ? "rounded-br-sm bg-forest text-white"
                      : "rounded-bl-sm bg-white text-ink"
                  )}
                >
                  {m.text}
                </span>
              </div>
            ))}
          </div>
          <form onSubmit={submit} className="flex items-center gap-2 border-t border-sage-200 p-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escreva uma mensagem..."
              className="flex-1 rounded-full border border-sage-200 px-4 py-2.5 text-sm outline-none focus:border-sage"
            />
            <button
              type="submit"
              className="grid h-11 w-11 place-items-center rounded-full bg-forest text-white hover:bg-forest-700"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
