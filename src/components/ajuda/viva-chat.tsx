"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LifeBuoy, Loader2, MessageCircle, Send, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHAVE_CONVERSA_CHAT, EVENTO_FALAR_COM_PESSOA, HREF_CHAMADO_DO_CHAT, SAUDACAO_CHAT, type MsgChat } from "@/lib/atendimento/viva-chat-texto";
import { PROMESSA_ATENDIMENTO } from "@/config/atendimento";
import { HREF_FALE_COM_A_VIVA } from "@/lib/ajuda/rotas";
import { ehCampoDeFormulario, flutuanteLevaAPagina, flutuanteVisivel } from "@/lib/atendimento/flutuante-visivel";
import { ehArraste, gravarPosicao, grudarNaBorda, lerPosicao, limitarBaixo, posicaoDuranteArraste, type Posicao, type Tamanho, type Tela } from "@/lib/atendimento/flutuante-arrastavel";
import { buttonClasses } from "@/components/ui/button";

/**
 * Chat da Viva (assistente virtual) — botão flutuante "Fale com a Viva" em todas
 * as páginas do SITE (público e painel) e bloco no topo da /ajuda. Visitante e
 * logado. Sem dados de conta: quando não resolve, "Falar com uma pessoa" leva ao formulário
 * único da Central (rota HREF_CHAMADO_DO_CHAT), com a conversa anexada. No app ele some (a Ajuda fica em Perfil).
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
const CHAVE = CHAVE_CONVERSA_CHAT;

/** E823: o que o botão flutuante abre, dito em palavras (rótulo ao passar o mouse/focar e title). */
export const ROTULO_BOTAO_VIVA = "Fale com a Viva · chat de atendimento";

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
  // E499: o flutuante mora no layout raiz e não desmonta ao trocar de tela; sem isto o chat ficava aberto ao navegar e
  // voltar ao painel. A troca de rota fecha o painel do chat (a conversa segue guardada na sessão).
  const [rotaDoChat, setRotaDoChat] = useState(pathname);
  if (rotaDoChat !== pathname) {
    setRotaDoChat(pathname);
    setAberto(false);
  }
  const [campoEmFoco, setCampoEmFoco] = useState(false);
  const [pos, setPos] = useState<Posicao | null>(null); // null = posição padrão (CSS)
  const [arrastando, setArrastando] = useState<{ esquerda: number; baixo: number } | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const gesto = useRef<{ id: number; x: number; y: number; dxBotao: number; baixo0: number; arrastou: boolean } | null>(null);
  const escondido = ESCONDER.some((p) => pathname === p || pathname.startsWith(p + "/"));
  // Página do imóvel no celular (Q4): só o ícone redondo, para não tampar
  // estrelas e o total do mês. A barra fixa fica embaixo; o nome acessível continua "Fale com a Viva".
  // C1b: em TODO o site o botão é o redondo (180 × 48 px com texto cobria texto de /termos, /empresas, /parceiros…); o nome
  // acessível continua "Fale com a Viva" e o menu do topo tem o mesmo link com texto.
  const compacto = true;
  // CONTA-A C4: no painel o botão é sempre o redondo (48 px) e a coluna reserva a faixa da direita (dashboard-shell),
  // para ele nunca sentar sobre um cartão durante a rolagem.
  const painel = pathname.startsWith("/dashboard");
  // E539 (v): no painel o botão leva à página Fale com a Viva (sem uma segunda janela do mesmo chat).
  const levaAPagina = flutuanteLevaAPagina(pathname);
  const router = useRouter();

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
      className={cn(
        "vn-viva-flut web-only fixed z-40 flex flex-col gap-3 print:hidden",
        pos?.lado === "esq" ? "items-start" : "items-end",
        !visivel && "max-md:hidden",
        // E246 (varredura do dono, 29/10; vigia, 31/10): no CELULAR (< 768 px) não há faixa livre para um botão fixo —
        // ao rolar ele sempre senta sobre algum texto ou cartão (a "Taxa de serviço" em Contratos, a foto do "Continue
        // seu anúncio", as listas das páginas públicas). Ali ele some em TODAS as telas; o "Fale com a Viva" continua no
        // menu ☰ do topo público e em Conta › Ajuda no painel. Do tablet para cima, nada muda.
        "max-md:hidden"
      )}
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
          if (levaAPagina) return router.push(HREF_FALE_COM_A_VIVA);
          setAberto((v) => !v);
        }}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        aria-expanded={levaAPagina ? undefined : aberto}
        aria-label={aberto ? "Fechar o chat" : "Fale com a Viva"}
        // E823: o redondo (C1b) só com o ícone não dizia o que abre — nome também no title e no rótulo visível abaixo.
        title={aberto ? "Fechar o chat" : ROTULO_BOTAO_VIVA}
        className={cn(buttonClasses(), "peer h-12 touch-none select-none shadow-flutuante lg:h-12", compacto && !aberto && "w-12 rounded-full px-0 sm:px-0", painel && !aberto && "w-12 rounded-full px-0 sm:px-0", arrastando && "cursor-grabbing")}
        data-testid="fale-com-a-viva"
        data-compacto={(compacto || painel) && !aberto ? "1" : undefined}
      >
        {aberto ? <X className="h-4 w-4" /> : <MessageCircle className={painel ? "h-5 w-5" : compacto ? "h-5 w-5" : "h-4 w-4"} />}
        <span className={painel && !aberto ? "sr-only" : compacto && !aberto ? "sr-only" : undefined}>{aberto ? "Fechar" : "Fale com a Viva"}</span>
      </button>
      {/* E823: identificação VISÍVEL do botão redondo — aparece ao passar o mouse ou ao focar pelo teclado (o botão
          com texto fixo cobria conteúdo das páginas, C1b). No celular o botão nem aparece (E246). */}
      {(compacto || painel) && !aberto && !arrastando && (
        <span
          aria-hidden
          className="pointer-events-none order-first hidden whitespace-nowrap rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white shadow-flutuante peer-hover:block peer-focus-visible:block"
          data-testid="fale-com-a-viva-rotulo"
        >
          {ROTULO_BOTAO_VIVA}
        </span>
      )}
    </div>
  );
}

/**
 * Bloco da página Fale com a Viva (mesma conversa do botão). E84: sem repetir a promessa — a página já a diz uma vez.
 * E539 (iii): aqui "Falar com uma pessoa" entrega a conversa ao "Abrir chamado" da Central (um formulário só na página).
 */
export function VivaChatBloco() {
  return (
    <section className="overflow-hidden rounded-xl border border-sage-200 bg-white" aria-label="Chat com a Viva" data-testid="viva-chat-bloco">
      <PainelChat altura="h-[420px]" semPromessa entregarPessoa />
    </section>
  );
}

function PainelChat({ onFechar, altura, semPromessa, entregarPessoa }: { onFechar?: () => void; altura: string; semPromessa?: boolean; entregarPessoa?: boolean }) {
  const [msgs, setMsgs] = useState<MsgChat[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sugerePessoa, setSugerePessoa] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setMsgs(carregar()), 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [msgs, enviando]);

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
          <p className="text-xs text-white/80">Assistente virtual da Viva Nomads{semPromessa ? "" : ` · ${PROMESSA_ATENDIMENTO.split(" · ")[1]}`}</p>
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
        <div ref={fim} />
      </div>

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
              className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-sage"
            />
            <button type="submit" disabled={enviando || !texto.trim()} aria-label="Enviar" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest text-white disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                if (entregarPessoa) window.dispatchEvent(new CustomEvent(EVENTO_FALAR_COM_PESSOA, { detail: { conversa: msgs } }));
                // E449: um formulário só. Na página Fale com a Viva, o da Central abre ali mesmo; fora dela, a rota única
                // leva à página com a conversa (guardada no sessionStorage) anexada.
                else window.location.assign(HREF_CHAMADO_DO_CHAT);
              }}
              className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-semibold", sugerePessoa ? "border-forest bg-forest/5 text-forest" : "border-line text-muted hover:text-ink")}
            >
              <UserRound className="h-3.5 w-3.5" /> Falar com uma pessoa
            </button>
            <Link href="/ajuda" className="inline-flex min-h-11 items-center gap-1 text-muted hover:text-ink">
              <LifeBuoy className="h-3.5 w-3.5" /> Central de Ajuda
            </Link>
          </div>
          <p className="text-[11px] text-muted">Não envie CPF, documentos ou senhas por aqui.</p>
        </div>
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

