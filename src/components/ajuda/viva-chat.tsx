"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, Loader2, MessageCircle, Send, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { abrirChamado } from "@/lib/data/atendimento-actions";
import { SAUDACAO_CHAT, transcricaoChat, type MsgChat } from "@/lib/atendimento/viva-chat-texto";
import { PROMESSA_ATENDIMENTO } from "@/config/atendimento";
import { SUPORTE_EMAIL } from "@/lib/site";

/**
 * Chat da Viva (assistente virtual) — botão flutuante "Fale com a Viva" em todas
 * as páginas do SITE (público e painel) e bloco no topo da /ajuda. Visitante e
 * logado. Sem dados de conta: quando não resolve, "Falar com uma pessoa" abre um
 * chamado com a conversa anexada. No app ele some (a Ajuda fica em Perfil).
 */
const ESCONDER = ["/ajuda", "/admin", "/auth", "/dashboard/conta/ajuda", "/dashboard/imoveis/novo", "/dashboard/fechamento"];
const CHAVE = "vivanomads-viva-chat";

function carregar(): MsgChat[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHAVE) ?? "[]");
    return Array.isArray(v) ? (v as MsgChat[]).slice(-40) : [];
  } catch {
    return [];
  }
}

function guardar(m: MsgChat[]) {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(m.slice(-40)));
  } catch {
    /* sem armazenamento: a conversa vale só enquanto a página está aberta */
  }
}

/** Botão flutuante (layout raiz). */
export function VivaChatFlutuante() {
  const pathname = usePathname() ?? "/";
  const [aberto, setAberto] = useState(false);
  if (ESCONDER.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;
  return (
    <div
      className="web-only fixed right-4 z-40 flex flex-col items-end gap-3 print:hidden md:right-6"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + var(--ajuda-bottom, 1.5rem))" }}
    >
      {aberto && (
        <div className="w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-sage-200 bg-white shadow-2xl" role="dialog" aria-label="Chat com a Viva">
          <PainelChat onFechar={() => setAberto(false)} altura="h-[min(520px,calc(100dvh-9rem))]" />
        </div>
      )}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-forest/90"
        data-testid="fale-com-a-viva"
      >
        {aberto ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        {aberto ? "Fechar" : "Fale com a Viva"}
      </button>
    </div>
  );
}

/** Bloco no topo da /ajuda (mesma conversa do botão). */
export function VivaChatBloco() {
  return (
    <section className="overflow-hidden rounded-2xl border border-sage-200 bg-white" aria-label="Chat com a Viva" data-testid="viva-chat-bloco">
      <PainelChat altura="h-[420px]" />
    </section>
  );
}

function PainelChat({ onFechar, altura }: { onFechar?: () => void; altura: string }) {
  const user = useAuthStore((s) => s.user);
  const [msgs, setMsgs] = useState<MsgChat[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sugerePessoa, setSugerePessoa] = useState(false);
  const [pessoa, setPessoa] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setMsgs(carregar()), 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [msgs, enviando, pessoa]);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    const nova: MsgChat[] = [...msgs, { role: "user", content: t.slice(0, 800) }];
    setMsgs(nova);
    guardar(nova);
    setTexto("");
    setEnviando(true);
    try {
      const r = await fetch("/api/viva/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mensagens: nova }) });
      const j = (await r.json().catch(() => ({}))) as { resposta?: string; sugerePessoa?: boolean };
      const resp: MsgChat[] = [...nova, { role: "assistant", content: j.resposta ?? 'Não consegui responder agora. Toque em "Falar com uma pessoa".' }];
      setMsgs(resp);
      guardar(resp);
      if (j.sugerePessoa) setSugerePessoa(true);
    } catch {
      const resp: MsgChat[] = [...nova, { role: "assistant", content: 'Sem conexão agora. Tente de novo ou toque em "Falar com uma pessoa".' }];
      setMsgs(resp);
      setSugerePessoa(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={cn("flex flex-col", altura)}>
      <header className="flex items-start gap-3 border-b border-sage-200 bg-forest px-4 py-3 text-white">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15">
          <MessageCircle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Viva</p>
          <p className="text-xs text-white/80">Assistente virtual da Viva Nomads · {PROMESSA_ATENDIMENTO.split(" · ")[1]}</p>
        </div>
        {onFechar && (
          <button type="button" onClick={onFechar} aria-label="Fechar o chat" className="rounded-full p-1 text-white/80 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto bg-surface px-3 py-3 text-sm" aria-live="polite">
        <Balao autor="assistant">{SAUDACAO_CHAT}</Balao>
        {msgs.map((m, i) => (
          <Balao key={i} autor={m.role}>
            {m.content}
          </Balao>
        ))}
        {enviando && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> A Viva está escrevendo…
          </p>
        )}
        {pessoa && <FormPessoa logado={!!user} msgs={msgs} onCancelar={() => setPessoa(false)} />}
        <div ref={fim} />
      </div>

      {!pessoa && (
        <div className="space-y-2 border-t border-sage-200 bg-white p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
            className="flex items-end gap-2"
          >
            <label className="sr-only" htmlFor="viva-chat-texto">
              Sua mensagem para a Viva
            </label>
            <textarea
              id="viva-chat-texto"
              rows={1}
              value={texto}
              maxLength={800}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              placeholder="Escreva sua dúvida…"
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-sage"
            />
            <button type="submit" disabled={enviando || !texto.trim()} aria-label="Enviar" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest text-white disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => setPessoa(true)}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold", sugerePessoa ? "border-forest bg-forest/5 text-forest" : "border-line text-muted hover:text-ink")}
            >
              <UserRound className="h-3.5 w-3.5" /> Falar com uma pessoa
            </button>
            <Link href="/ajuda" className="inline-flex items-center gap-1 text-muted hover:text-ink">
              <LifeBuoy className="h-3.5 w-3.5" /> Central de Ajuda
            </Link>
          </div>
          <p className="text-[11px] text-muted">Não envie CPF, documentos ou senhas por aqui.</p>
        </div>
      )}
    </div>
  );
}

function Balao({ autor, children }: { autor: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div className={cn("max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2", autor === "user" ? "ml-auto bg-forest text-white" : "bg-white text-ink shadow-sm")}>
      {children}
    </div>
  );
}

function FormPessoa({ logado, msgs, onCancelar }: { logado: boolean; msgs: MsgChat[]; onCancelar: () => void }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [pedido, setPedido] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<{ numero: string } | null>(null);

  async function abrir() {
    setErro(null);
    // Sem conversa ainda: vai só o pedido; com conversa, ela vai anexada.
    const mensagem = msgs.length ? transcricaoChat(msgs, pedido) : pedido.trim();
    if (!msgs.length && pedido.trim().length < 5) return setErro("Conte em poucas palavras o que você precisa.");
    setEnviando(true);
    const r = await abrirChamado({
      categoria: "duvida",
      mensagem,
      assunto: "Conversa com a Viva (chat do site)",
      canal: "site",
      pedePessoa: true,
      ...(logado ? {} : { visitanteNome: nome, visitanteEmail: email }),
    }).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." }));
    setEnviando(false);
    if (!r.ok) return setErro(r.error ?? "Não foi possível abrir o chamado agora.");
    setOk({ numero: r.numero });
    try {
      sessionStorage.removeItem(CHAVE);
    } catch {
      /* ignore */
    }
  }

  if (ok) {
    return (
      <div className="rounded-2xl border border-sage-200 bg-white p-3 text-ink" data-testid="chamado-aberto-chat">
        <p className="font-semibold">Chamado {ok.numero} aberto.</p>
        <p className="mt-1 text-xs text-muted">
          A conversa foi anexada. {logado ? "Você acompanha em Ajuda → Meus chamados." : "Enviamos a confirmação para o seu e-mail; a resposta chega por lá."} {PROMESSA_ATENDIMENTO.split(" · ")[1]}. Dúvidas: {SUPORTE_EMAIL}.
        </p>
        {logado && (
          <Link href={`/ajuda?chamado=${ok.numero}`} className="mt-2 inline-block text-xs font-semibold text-forest underline">
            Abrir o chamado
          </Link>
        )}
      </div>
    );
  }

  const campo = "w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-sage";
  return (
    <div className="space-y-2 rounded-2xl border border-sage-200 bg-white p-3" data-testid="form-pessoa">
      <p className="text-sm font-semibold text-ink">Falar com uma pessoa</p>
      <p className="text-xs text-muted">Abrimos um chamado com esta conversa. {PROMESSA_ATENDIMENTO.split(" · ")[1]}.</p>
      {!logado && (
        <>
          <input className={campo} placeholder="Seu nome" value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} aria-label="Seu nome" />
          <input className={campo} type="email" placeholder="Seu e-mail (a resposta chega por lá)" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Seu e-mail" />
        </>
      )}
      <textarea className={cn(campo, "min-h-[60px]")} placeholder={msgs.length ? "Quer acrescentar algo? (opcional)" : "O que você precisa?"} value={pedido} maxLength={600} onChange={(e) => setPedido(e.target.value)} aria-label="Pedido para a equipe" />
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={abrir} disabled={enviando} className="rounded-lg bg-forest px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          {enviando ? "Abrindo…" : "Abrir chamado"}
        </button>
        <button type="button" onClick={onCancelar} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-ink">
          Voltar ao chat
        </button>
      </div>
    </div>
  );
}
