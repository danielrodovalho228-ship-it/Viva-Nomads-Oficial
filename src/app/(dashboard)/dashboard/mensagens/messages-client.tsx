"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Send, ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/dashboard/primitives";
import { Avatar } from "@/components/ui/avatar";
import { sendMessage } from "@/lib/data/actions";
import { getAvatarUrl } from "@/lib/data/avatar-actions";
import type { Conversation } from "@/lib/data/messages";
import { guardContactInfo, GUARD_NOTICE } from "@/lib/messages/contact-guard";
import { useDemoMode, DemoBadge } from "@/lib/demo/demo-mode";
import { DEMO_CONVERSATIONS } from "@/lib/demo/seed";
import { cn } from "@/lib/utils";

/**
 * Modo demonstração (admin): troca a fonte pelo seed e REMONTA o inner via
 * `key` (o estado interno nasce da prop). Em demo, o envio não persiste nada.
 */
export function MessagesClient({ initial }: { initial: Conversation[] }) {
  const { on: demoOn } = useDemoMode();
  return (
    <MessagesInner
      key={demoOn ? "demo" : "real"}
      initial={demoOn ? DEMO_CONVERSATIONS : initial}
      demo={demoOn}
    />
  );
}

function MessagesInner({ initial, demo }: { initial: Conversation[]; demo: boolean }) {
  const [conversations, setConversations] = useState<Conversation[]>(initial);
  const [activeId, setActiveId] = useState<string>(initial[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  // Fotos das conversas (map conversationId → URL). O SERVIDOR decide: foto do
  // proprietário é pública; foto do inquilino só vem se a relação foi aceita.
  // Sem direito / demo → null → o Avatar cai para iniciais. Nunca em demo.
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  useEffect(() => {
    if (demo) return;
    let alive = true;
    (async () => {
      const entries = await Promise.all(
        conversations
          .filter((c) => c.otherId)
          .map(async (c) => {
            const { url } = await getAvatarUrl({ targetId: c.otherId as string, propertyId: c.propertyId });
            return [c.id, url] as const;
          })
      );
      if (alive) setAvatars(Object.fromEntries(entries));
    })().catch(() => {});
    return () => {
      alive = false;
    };
    // Recarrega quando o conjunto de conversas muda (ids).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, conversations.map((c) => c.id).join(",")]);
  // Aviso de contato protegido (aparece quando algo foi mascarado no envio).
  const [guardNotice, setGuardNotice] = useState(false);
  // No mobile, alterna entre lista e conversa (master-detail). No desktop, ambos.
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

  function openConversation(id: string) {
    setActiveId(id);
    setMobileView("chat");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !active) return;
    // Mesma máscara do servidor: o eco otimista mostra exatamente o que será
    // gravado (telefones/e-mails sempre protegidos — a conversa fica na plataforma).
    const { text, masked } = guardContactInfo(draft);
    setGuardNotice(masked);
    setDraft("");
    // Atualização otimista
    setConversations((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? { ...c, preview: text, messages: [...c.messages, { id: `tmp-${Date.now()}`, from: "me", text }] }
          : c
      )
    );
    // Persiste (Supabase quando configurado). Em modo demonstração NUNCA
    // grava: a conversa é fictícia e o envio fica só na tela.
    if (!demo) {
      await sendMessage({
        conversationId: active.id,
        receiverId: active.otherId,
        propertyId: active.propertyId,
        body: text,
      });
    }
  }

  if (!active) {
    return (
      <>
        <PageTitle title="Mensagens" />
        <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
          <Image src="/media/empty-mensagens.webp" alt="" width={176} height={176} className="mx-auto h-44 w-44" />
          <h3 className="mt-4 font-title text-lg font-bold text-ink">Nenhuma conversa ainda</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Quando um interessado enviar uma mensagem sobre um imóvel, a conversa aparece aqui.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Mensagens" action={demo ? <DemoBadge /> : undefined} />
      <div className="grid h-[75vh] overflow-hidden rounded-2xl border border-sage-200 bg-white md:h-[70vh] md:grid-cols-3">
        {/* Lista — no mobile some quando uma conversa está aberta */}
        <aside
          className={cn(
            "border-r border-sage-200 md:col-span-1 md:block",
            mobileView === "chat" && "hidden"
          )}
        >
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c.id)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-sage-200 px-4 py-3 text-left transition-colors",
                active.id === c.id ? "bg-blue-50 md:bg-blue-50" : "hover:bg-surface-2"
              )}
            >
              <Avatar name={c.name} size={40} photoUrl={avatars[c.id] ?? undefined} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="truncate font-medium text-ink">{c.name}</span>
                  <span className="shrink-0 text-xs text-muted">{c.property}</span>
                </span>
                <span className="line-clamp-1 text-sm text-muted">{c.preview}</span>
              </span>
            </button>
          ))}
        </aside>

        {/* Chat — no mobile some quando se está vendo a lista */}
        <section
          className={cn(
            "flex flex-col md:col-span-2 md:flex",
            mobileView === "list" && "hidden"
          )}
        >
          <header className="flex items-center gap-2 border-b border-sage-200 px-4 py-3 md:px-5">
            <button
              type="button"
              onClick={() => setMobileView("list")}
              aria-label="Voltar para a lista"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-surface-2 md:hidden"
            >
              <ArrowLeft className="h-5 w-5 text-ink" />
            </button>
            <Avatar name={active.name} size={36} photoUrl={avatars[active.id] ?? undefined} />
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{active.name}</p>
              {active.property && (
                <p className="truncate text-xs text-muted">Sobre: {active.property}</p>
              )}
            </div>
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
          {guardNotice && (
            <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              {GUARD_NOTICE}
            </p>
          )}
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
