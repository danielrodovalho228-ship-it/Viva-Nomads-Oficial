"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Send, ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/dashboard/primitives";
import { DenunciarConversa } from "@/components/mensagens/denunciar-conversa";
import { Avatar } from "@/components/ui/avatar";
import { sendMessage } from "@/lib/data/actions";
import { getAvatarUrl } from "@/lib/data/avatar-actions";
import type { Conversation } from "@/lib/data/messages";
import { guardContactInfo, GUARD_NOTICE } from "@/lib/messages/contact-guard";
import { useDemoMode, DemoBadge } from "@/lib/demo/demo-mode";
import { DEMO_CONVERSATIONS } from "@/lib/demo/seed";
import { FILTROS, contarPorFiltro, filtrarConversas, type Filtro } from "@/lib/mensagens-filtros";
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
  const [filtro, setFiltro] = useState<Filtro>("todas");
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

  const contagem = contarPorFiltro(conversations);
  const visiveis = filtrarConversas(conversations, filtro);
  // A conversa aberta acompanha o chip: se ela saiu do filtro, abre a primeira que sobrou.
  const active = visiveis.find((c) => c.id === activeId) ?? visiveis[0] ?? conversations[0];

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
      <div role="group" aria-label="Filtrar conversas" className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            data-testid={`mensagens-filtro-${f.id}`}
            aria-pressed={filtro === f.id}
            onClick={() => {
              setFiltro(f.id);
              setMobileView("list");
            }}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
              filtro === f.id ? "border-forest bg-forest text-white" : "border-sage-200 bg-white text-ink hover:bg-surface-2"
            )}
          >
            {f.rotulo}
            <span className={cn("text-xs", filtro === f.id ? "text-white/80" : "text-muted")}>{contagem[f.id]}</span>
          </button>
        ))}
      </div>
      <div className="grid h-[75vh] overflow-hidden rounded-2xl border border-sage-200 bg-white md:h-[70vh] md:grid-cols-3">
        {/* Lista — no mobile some quando uma conversa está aberta */}
        <aside
          className={cn(
            "border-r border-sage-200 md:col-span-1 md:block",
            mobileView === "chat" && "hidden"
          )}
        >
          {visiveis.length === 0 && (
            <p data-testid="mensagens-filtro-vazio" className="p-6 text-center text-sm text-muted">
              Nenhuma conversa neste filtro.
            </p>
          )}
          {visiveis.map((c) => (
            <button
              key={c.id}
              data-testid="mensagens-conversa"
              onClick={() => openConversation(c.id)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-sage-200 px-4 py-3 text-left transition-colors",
                active.id === c.id ? "bg-blue-50 md:bg-blue-50" : "hover:bg-surface-2"
              )}
            >
              {c.foto ? (
                // Foto do imóvel (capa); a pessoa fica no nome ao lado.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.foto} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <Avatar name={c.name} size={48} photoUrl={avatars[c.id] ?? undefined} />
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium text-ink">{c.name}</span>
                {(c.property || c.periodo) && (
                  <span className="truncate text-xs text-muted">{[c.property, c.periodo].filter(Boolean).join(" · ")}</span>
                )}
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
          {/* Conversa com imóvel = entre pessoas; "Suporte" é a equipe, não há o que denunciar. */}
          {active.papel !== "suporte" && <DenunciarConversa key={active.id} conversationId={active.id} demo={demo} />}
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
