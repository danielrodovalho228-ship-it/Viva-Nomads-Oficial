"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { PageTitle } from "@/components/dashboard/primitives";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  name: string;
  property: string;
  preview: string;
  messages: { from: "me" | "them"; text: string }[];
}

const CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    name: "Ana Carvalho",
    property: "Apto Santa Mônica",
    preview: "O imóvel está disponível em agosto?",
    messages: [
      { from: "them", text: "Olá! O imóvel está disponível a partir de agosto?" },
      { from: "me", text: "Olá, Ana! Sim, disponível a partir de 1º de agosto." },
      { from: "them", text: "Ótimo. Tem home office? Trabalho remoto." },
    ],
  },
  {
    id: "2",
    name: "Rafael Lima",
    property: "Studio Centro",
    preview: "Posso agendar uma visita?",
    messages: [
      { from: "them", text: "Bom dia! Posso agendar uma visita esta semana?" },
    ],
  },
];

export default function MessagesPage() {
  const [active, setActive] = useState(CONVERSATIONS[0]);
  const [draft, setDraft] = useState("");

  return (
    <>
      <PageTitle title="Mensagens" />
      <div className="grid h-[70vh] overflow-hidden rounded-2xl border border-sage-200 bg-white md:grid-cols-3">
        {/* Lista */}
        <aside className="border-r border-sage-200 md:col-span-1">
          {CONVERSATIONS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c)}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 border-b border-sage-200 px-4 py-3 text-left transition-colors",
                active.id === c.id ? "bg-sage-100" : "hover:bg-surface-2"
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
            <p className="text-xs text-muted">Sobre: {active.property}</p>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-surface-2 p-5">
            {active.messages.map((m, i) => (
              <div key={i} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              active.messages.push({ from: "me", text: draft });
              setDraft("");
            }}
            className="flex items-center gap-2 border-t border-sage-200 p-3"
          >
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
