"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, Loader2, MessageCircle, Send, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { useCaptcha } from "@/components/seguranca/captcha";
import { MSG_CAPTCHA_PENDENTE, podeEnviar } from "@/lib/seguranca/captcha";
import { abrirChamado } from "@/lib/data/atendimento-actions";
import { SAUDACAO_CHAT, transcricaoChat, type MsgChat } from "@/lib/atendimento/viva-chat-texto";
import { PROMESSA_ATENDIMENTO } from "@/config/atendimento";
import { SUPORTE_EMAIL } from "@/lib/site";
import { ehCampoDeFormulario, flutuanteVisivel } from "@/lib/atendimento/flutuante-visivel";
import { ehArraste, gravarPosicao, grudarNaBorda, lerPosicao, limitarBaixo, posicaoDuranteArraste, type Posicao, type Tamanho, type Tela } from "@/lib/atendimento/flutuante-arrastavel";
import { buttonClasses } from "@/components/ui/button";

/**
 * Chat da Viva (assistente virtual) — botão flutuante "Fale com a Viva" em todas
 * as páginas do SITE (público e painel) e bloco no topo da /ajuda. Visitante e
 * logado. Sem dados de conta: quando não resolve, "Falar com uma pessoa" abre um
 * chamado com a conversa anexada. No app ele some (a Ajuda fica em Perfil).
 */
// Fica fora só onde a própria tela já é a ajuda (/ajuda) ou é um fluxo de formulário
// (login, anúncio, fechamento, segurança — t58) e no admin.
// "/dashboard/conta/seguranca": cobria "Nova senha"/"Salvar nova senha" e os botões do 2FA a 390 px (t58).
// "/app/boas-vindas": tela de 100dvh do app; o botão cobria "Quero anunciar" e o respiro do fim da página a fazia rolar (t16).
// "/dashboard/conta/perfil" (E60, print do Daniel 24/10): no celular o botão montava sobre a barra de abas, cobrindo
// "Perfil"; nesta tela a Ajuda da Conta já oferece o "Fale com a Viva".
// "/dashboard/mensagens": a tela já é uma conversa (com a aba Suporte); no computador o botão ficava em cima do
// "Enviar" da caixa de mensagem e o proprietário não conseguia mandar a resposta (t182).
// "/buscar" (E95): no celular o botão sentava sobre o título dos cartões; a ajuda da busca fica como link no fim da lista.
export const ESCONDER = ["/buscar", "/ajuda", "/admin", "/auth", "/dashboard/conta/ajuda", "/dashboard/imoveis/novo", "/dashboard/fechamento", "/dashboard/conta/seguranca", "/dashboard/conta/privacidade", "/app/boas-vindas", "/dashboard/mensagens", "/dashboard/conta/perfil"];
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

/** Botão flutuante (layout raiz). Arrastável (ordem a9982623): parado no canto, sem recalcular em scroll. */
export function VivaChatFlutuante() {
  const pathname = usePathname() ?? "/";
  const [aberto, setAberto] = useState(false);
  const [campoEmFoco, setCampoEmFoco] = useState(false);
  const [pos, setPos] = useState<Posicao | null>(null); // null = posição padrão (CSS)
  const [arrastando, setArrastando] = useState<{ esquerda: number; baixo: number } | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const gesto = useRef<{ id: number; x: number; y: number; dxBotao: number; baixo0: number; arrastou: boolean } | null>(null);
  const escondido = ESCONDER.some((p) => pathname === p || pathname.startsWith(p + "/"));
  // Página do imóvel no celular (Q4): só o ícone redondo, para não tampar
  // estrelas e o total do mês. A barra fixa fica embaixo; o nome acessível continua "Fale com a Viva".
  const compacto = pathname.startsWith("/imoveis/");
  // CONTA-A C4: no painel o botão é sempre o redondo (48 px) e a coluna reserva a faixa da direita (dashboard-shell),
  // para ele nunca sentar sobre um cartão durante a rolagem.
  const painel = pathname.startsWith("/dashboard");

  const medirTela = (): Tela => ({ largura: window.innerWidth, altura: window.innerHeight });
  const tamanhoBotao = (): Tamanho => {
    const r = botao.current?.getBoundingClientRect();
    return { largura: r?.width ?? 160, altura: r?.height ?? 48 };
  };

  // Posição salva (só no navegador) e reenquadramento se a janela mudar de tamanho.
  useEffect(() => {
    if (escondido) return;
    const t = setTimeout(() => setPos(lerPosicao(typeof localStorage === "undefined" ? null : localStorage)), 0);
    const aoRedimensionar = () => setPos((p) => (p ? { ...p, baixo: limitarBaixo(p.baixo, medirTela(), tamanhoBotao()) } : p));
    window.addEventListener("resize", aoRedimensionar);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, [escondido]);

  // F49: some só enquanto a pessoa digita num campo (celular); volta ao sair do campo.
  useEffect(() => {
    if (escondido) return;
    const fora = (el: EventTarget | null) => !(el instanceof Element) || !raiz.current?.contains(el);
    const aoFocar = (e: FocusEvent) => {
      const el = e.target;
      if (el instanceof HTMLElement && fora(el)) setCampoEmFoco(ehCampoDeFormulario(el.tagName, (el as HTMLInputElement).type));
    };
    const aoSair = () => setCampoEmFoco(false);
    document.addEventListener("focusin", aoFocar);
    document.addEventListener("focusout", aoSair);
    return () => {
      document.removeEventListener("focusin", aoFocar);
      document.removeEventListener("focusout", aoSair);
      setCampoEmFoco(false);
    };
  }, [pathname, escondido]);

  function aoPressionar(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 || aberto) return;
    const r = e.currentTarget.getBoundingClientRect();
    gesto.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dxBotao: e.clientX - r.left, baixo0: window.innerHeight - r.bottom, arrastou: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function aoMover(e: React.PointerEvent<HTMLButtonElement>) {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    if (!g.arrastou && !ehArraste(e.clientX - g.x, e.clientY - g.y)) return;
    g.arrastou = true;
    const tam = tamanhoBotao();
    const tela = medirTela();
    setArrastando(posicaoDuranteArraste(e.clientX - g.dxBotao, g.baixo0 - (e.clientY - g.y), tela, tam));
  }
  function aoSoltar(e: React.PointerEvent<HTMLButtonElement>) {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (g.arrastou && arrastando) {
      const tam = tamanhoBotao();
      const nova = grudarNaBorda(arrastando.esquerda + tam.largura / 2, arrastando.baixo, medirTela(), tam);
      setPos(nova);
      gravarPosicao(typeof localStorage === "undefined" ? null : localStorage, nova);
    }
    setArrastando(null);
    // O clique que o navegador dispara logo após um arraste não pode abrir o chat.
    if (g.arrastou) setTimeout(() => (gesto.current = null), 0);
    else gesto.current = null;
  }

  if (escondido) return null;
  const visivel = flutuanteVisivel({ chatAberto: aberto, campoEmFoco });
  const estilo: React.CSSProperties = arrastando
    ? { left: arrastando.esquerda, right: "auto", bottom: arrastando.baixo }
    : pos
      ? { bottom: `max(${pos.baixo}px, var(--viva-piso, 0px))`, ...(pos.lado === "esq" ? { left: 16, right: "auto" } : { right: 16, left: "auto" }) }
      : {};
  return (
    <div
      ref={raiz}
      className={cn("vn-viva-flut web-only fixed z-40 flex flex-col gap-3 print:hidden", pos?.lado === "esq" ? "items-start" : "items-end", !visivel && "max-md:hidden")}
      style={estilo}
      data-posicao={arrastando ? "arrastando" : pos ? pos.lado : "padrao"}
      data-testid="fale-com-a-viva-raiz"
    >
      {aberto && (
        <div className="w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-sage-200 bg-white shadow-flutuante" role="dialog" aria-label="Chat com a Viva">
          <PainelChat onFechar={() => setAberto(false)} altura="h-[min(520px,calc(100dvh-9rem))]" />
        </div>
      )}
      {/* Mesmo botão primário do site (tokens do <Button>), igual em todas as
          páginas e larguras: ícone + texto. Clique curto abre; arrastar move.
          É o botão flutuante: o ÚNICO com sombra (shadow-flutuante, Prompt 40). */}
      <button
        ref={botao}
        type="button"
        onClick={() => {
          if (gesto.current?.arrastou) return;
          setAberto((v) => !v);
        }}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        aria-expanded={aberto}
        aria-label={aberto ? "Fechar o chat" : "Fale com a Viva"}
        className={cn(buttonClasses(), "h-12 touch-none select-none shadow-flutuante lg:h-12", compacto && !aberto && "max-lg:h-12 max-lg:w-12 max-lg:rounded-full max-lg:px-0", painel && !aberto && "w-12 rounded-full px-0 sm:px-0", arrastando && "cursor-grabbing")}
        data-testid="fale-com-a-viva"
        data-compacto={(compacto || painel) && !aberto ? "1" : undefined}
      >
        {aberto ? <X className="h-4 w-4" /> : <MessageCircle className={painel ? "h-5 w-5" : compacto ? "h-4 w-4 max-lg:h-5 max-lg:w-5" : "h-4 w-4"} />}
        <span className={painel && !aberto ? "sr-only" : compacto && !aberto ? "max-lg:sr-only" : undefined}>{aberto ? "Fechar" : "Fale com a Viva"}</span>
      </button>
    </div>
  );
}

/** Bloco no topo da /ajuda (mesma conversa do botão). */
export function VivaChatBloco() {
  return (
    <section className="overflow-hidden rounded-xl border border-sage-200 bg-white" aria-label="Chat com a Viva" data-testid="viva-chat-bloco">
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
          <p className="text-sm font-semibold">Viva</p>
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
          <p className="flex items-center gap-2 text-xs text-muted">
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
            <button type="submit" disabled={enviando || !texto.trim()} aria-label="Enviar" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest text-white disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => setPessoa(true)}
              className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold", sugerePessoa ? "border-forest bg-forest/5 text-forest" : "border-line text-muted hover:text-ink")}
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
    <div
      data-testid={autor === "user" ? "viva-chat-msg-usuario" : "viva-chat-msg-viva"}
      className={cn("max-w-[85%] whitespace-pre-line rounded-xl px-3 py-2", autor === "user" ? "ml-auto bg-forest text-white" : "bg-white text-ink ")}
    >
      {children}
    </div>
  );
}

function FormPessoa({ logado, msgs, onCancelar }: { logado: boolean; msgs: MsgChat[]; onCancelar: () => void }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [pedido, setPedido] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<{ numero: string } | null>(null);
  const captcha = useCaptcha();

  async function abrir() {
    setErro(null);
    if (!logado && !podeEnviar(captcha.ligado, captcha.token)) return setErro(MSG_CAPTCHA_PENDENTE);
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
      ...(logado ? {} : { visitanteNome: nome, visitanteEmail: email, visitanteTelefone: telefone, captchaToken: captcha.token ?? undefined }),
    }).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." }));
    if (!logado) captcha.reset(); // o token vale uma vez só
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
      <div className="rounded-xl border border-sage-200 bg-white p-3 text-ink" data-testid="chamado-aberto-chat">
        <p className="font-semibold">Chamado {ok.numero} aberto.</p>
        <p className="mt-1 text-xs text-muted">
          A conversa foi anexada. {logado ? "Você acompanha em Ajuda → Meus chamados." : "Enviamos a confirmação para o seu e-mail; a resposta chega por lá."} Uma pessoa responde em até 24 h. Dúvidas: {SUPORTE_EMAIL}.
        </p>
        {logado && (
          // <a> de propósito: na própria /ajuda, um Link só trocaria a URL e a
          // Central (que lê o ?chamado= ao abrir) não mostraria o chamado.
          <a href={`/ajuda?chamado=${ok.numero}`} className="mt-2 inline-block text-xs font-semibold text-forest underline">
            Abrir o chamado
          </a>
        )}
      </div>
    );
  }

  const campo = "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-sage";
  return (
    <div className="space-y-2 rounded-xl border border-sage-200 bg-white p-3" data-testid="form-pessoa">
      <p className="text-sm font-semibold text-ink">Falar com uma pessoa</p>
      <p className="text-xs text-muted">Abrimos um chamado com esta conversa. Uma pessoa responde em até 24 h.</p>
      {!logado && (
        <>
          <input required minLength={2} name="nome" autoComplete="name" className={campo} placeholder="Seu nome" value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} aria-label="Seu nome" />
          <input className={campo} type="email" name="email" autoComplete="email" placeholder="Seu e-mail (a resposta chega por lá)" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Seu e-mail" />
          <input className={campo} type="tel" inputMode="tel" name="telefone" autoComplete="tel" maxLength={20} placeholder="Telefone com DDD (opcional)" value={telefone} onChange={(e) => setTelefone(e.target.value)} aria-label="Telefone com DDD (opcional)" />
          {captcha.widget}
        </>
      )}
      <textarea className={cn(campo, "min-h-[60px]")} placeholder={msgs.length ? "Quer acrescentar algo? (opcional)" : "O que você precisa?"} value={pedido} maxLength={600} onChange={(e) => setPedido(e.target.value)} aria-label="Pedido para a equipe" />
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={abrir} disabled={enviando} className={buttonClasses({ size: "sm" })}>
          {enviando ? "Abrindo…" : "Abrir chamado"}
        </button>
        <button type="button" onClick={onCancelar} className="rounded-lg px-3 py-2 text-sm text-muted hover:text-ink">
          Voltar ao chat
        </button>
      </div>
    </div>
  );
}
