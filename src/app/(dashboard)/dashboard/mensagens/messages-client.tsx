"use client";

import { marcarConversaAberta } from "@/lib/data/conversa-aberta-actions";
import { FichaPetCandidatura } from "@/components/pets/ficha-pet-candidatura";
import { SeloLinkedin } from "@/components/confianca/selo-linkedin";
import { useEffect, useState } from "react";
import { Send, ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import Link from "next/link";
import { AvisoAntigolpe } from "@/components/seguranca/aviso-antigolpe";
import { AVISO_ANTIGOLPE_ALERTA, pareceDadoBancario } from "@/lib/seguranca/antigolpe";
import { DenunciarConversa } from "@/components/mensagens/denunciar-conversa";
import { Avatar } from "@/components/ui/avatar";
import { sendMessage } from "@/lib/data/actions";
import { enviarMensagemDoPedido } from "@/lib/parceiros/pedido-actions";
import { getAvatarUrl } from "@/lib/data/avatar-actions";
import type { Conversation } from "@/lib/data/messages";
import { guardContactInfo, GUARD_NOTICE, DOCUMENTO_BLOQUEADO, AVISO_DOCUMENTOS } from "@/lib/messages/contact-guard";
import { useDemoMode, DemoBadge } from "@/lib/demo/demo-mode";
import { DEMO_CONVERSATIONS } from "@/lib/demo/seed";
import { FILTROS, contarPorFiltro, filtrarConversas, type Filtro } from "@/lib/mensagens-filtros";
import { cn } from "@/lib/utils";
import { CartaoVisita } from "@/components/visitas/cartao-visita";
import { visitaDaConversa } from "@/lib/data/visitas-video-actions";
import { AvaliacaoNaConversaCartao } from "@/components/vistoria/avaliacao-na-conversa";
import { RespostasRapidasConversa } from "@/components/mensagens/respostas-rapidas-conversa";
import { MSG_CONTATO_BLOQUEADO, temContato } from "@/lib/respostas/regras";

/**
 * Modo demonstração (admin): troca a fonte pelo seed e REMONTA o inner via
 * `key` (o estado interno nasce da prop). Em demo, o envio não persiste nada.
 */
export function MessagesClient({ initial, abrir }: { initial: Conversation[]; /** Conversa a abrir (ex.: "Mensagem" da página da estadia). */ abrir?: string }) {
  const { on: demoOn } = useDemoMode();
  return (
    <MessagesInner
      key={demoOn ? "demo" : "real"}
      initial={demoOn ? DEMO_CONVERSATIONS : initial}
      demo={demoOn}
      abrir={demoOn ? undefined : abrir}
    />
  );
}

function MessagesInner({ initial, demo, abrir }: { initial: Conversation[]; demo: boolean; abrir?: string }) {
  const [conversations, setConversations] = useState<Conversation[]>(initial);
  // A conversa aberta mora também na URL (?conversa=): se a tela remontar (o painel remonta o conteúdo quando o modo
  // é acertado pelo perfil logo depois de carregar), ela volta na mesma conversa — nunca cai na primeira da lista com o
  // cartão de outra (QA 21/10, "cartão residual nas Conversas").
  const pedida = (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("conversa") : null) ?? abrir;
  const existe = !!pedida && initial.some((c) => c.id === pedida);
  const [activeId, setActiveId] = useState<string>((existe ? pedida : initial[0]?.id) ?? "");
  const [draft, setDraft] = useState("");
  // Prompt 55-E2: o texto do campo veio de uma resposta rápida? Então contato direto BLOQUEIA (não mascara).
  const [deRapida, setDeRapida] = useState(false);
  const [rapidaBloqueada, setRapidaBloqueada] = useState(false);
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
  // Prompt 32: CPF/RG não vai pelo chat; a mensagem fica no campo e o aviso leva aos Ocupantes da estadia.
  const [docBloqueado, setDocBloqueado] = useState(false);
  // No mobile, alterna entre lista e conversa (master-detail). No desktop, ambos.
  const [mobileView, setMobileView] = useState<"list" | "chat">(existe ? "chat" : "list");

  const contagem = contarPorFiltro(conversations);
  const visiveis = filtrarConversas(conversations, filtro);
  // A conversa aberta acompanha o chip: se ela saiu do filtro, abre a primeira que sobrou.
  const active = visiveis.find((c) => c.id === activeId) ?? visiveis[0] ?? conversations[0];

  // Prompt 44: com a conversa aberta (e a aba visível), a próxima mensagem dela não vira push no celular. Renova a cada
  // 5 min enquanto ela fica na tela (a regra do push olha os últimos 10 min).
  const conversaAbertaId = active?.id;
  useEffect(() => {
    if (demo || !conversaAbertaId) return;
    const marcar = () => {
      if (document.visibilityState === "visible") marcarConversaAberta(conversaAbertaId).catch(() => {});
    };
    marcar();
    const t = setInterval(marcar, 5 * 60_000);
    document.addEventListener("visibilitychange", marcar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", marcar);
    };
  }, [demo, conversaAbertaId]);

  function openConversation(id: string) {
    setActiveId(id);
    setMobileView("chat");
    if (!demo) {
      const url = new URL(window.location.href);
      url.searchParams.set("conversa", id);
      window.history.replaceState(window.history.state, "", url);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !active) return;
    setRapidaBloqueada(false);
    if (deRapida && temContato(draft)) return setRapidaBloqueada(true);
    // Mesma máscara do servidor: o eco otimista mostra exatamente o que será
    // gravado (telefones/e-mails sempre protegidos — a conversa fica na plataforma).
    const { text, masked, documento } = guardContactInfo(draft);
    setDocBloqueado(documento);
    if (documento) return;
    setGuardNotice(masked);
    setDraft("");
    const usouRapida = deRapida;
    setDeRapida(false);
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
      // Conversa de pedido de serviço (Prompt 31b): o servidor confere a parte do pedido e grava na conversa dele.
      if (active.pedidoParceiroId) await enviarMensagemDoPedido(active.pedidoParceiroId, text);
      else
        await sendMessage({
          conversationId: active.id,
          receiverId: active.otherId,
          propertyId: active.propertyId,
          body: text,
          respostaRapida: usouRapida,
        });
    }
  }

  if (!active) {
    return (
      <>
        <PageTitle title="Mensagens" />
        {/* Prompt 48: sem ilustração; diz como a conversa funciona e o próximo passo. */}
        <div className="rounded-xl border border-line bg-white p-6 sm:p-8" data-testid="mensagens-vazio">
          <h2 className="font-title text-lg font-semibold text-ink">Nenhuma conversa ainda</h2>
          <p className="mt-2 max-w-md text-sm text-muted">
            A conversa começa quando você pede um imóvel ou quando alguém pede o seu. Tudo fica aqui, com o imóvel e as
            datas no topo; telefone e e-mail só aparecem depois do aceite.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ButtonLink href="/buscar" variant="secondary" size="sm">
              Buscar imóveis
            </ButtonLink>
            <Link href="/como-funciona#para-inquilinos" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-forest">
              Como funciona a conversa
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Mensagens" action={demo ? <DemoBadge /> : undefined} />
      <AvisoAntigolpe className="mb-3" />
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
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
              filtro === f.id ? "border-forest bg-forest text-white" : "border-sage-200 bg-white text-ink hover:bg-surface-2"
            )}
          >
            {f.rotulo}
            <span className={cn("text-xs", filtro === f.id ? "text-white/80" : "text-muted")}>{contagem[f.id]}</span>
          </button>
        ))}
      </div>
      <div className="grid h-[75vh] overflow-hidden rounded-xl border border-sage-200 bg-white md:h-[70vh] md:grid-cols-3">
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
              data-conversa={c.id}
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
              <span className="flex min-w-0 flex-1 flex-col gap-1">
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
          <header className="flex items-center gap-2 border-b border-sage-200 px-4 py-3 md:px-4">
            <button
              type="button"
              onClick={() => setMobileView("list")}
              aria-label="Voltar para a lista"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-surface-2 md:hidden"
            >
              <ArrowLeft className="h-5 w-5 text-ink" />
            </button>
            <span className="shrink-0" data-testid="conversa-avatar">
              <Avatar name={active.name} size={36} photoUrl={avatars[active.id] ?? undefined} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-ink" data-testid="conversa-nome">{active.name}</p>
              {active.linkedinConectado && <SeloLinkedin />}
              {active.property && (
                <p className="truncate text-xs text-muted">Sobre: {active.property}</p>
              )}
              {active.pedidoParceiroId && (
                <Link href={`/dashboard/servicos/pedidos/${active.pedidoParceiroId}`} className="text-xs font-semibold text-forest underline" data-testid="conversa-abrir-pedido">
                  Abrir o pedido
                </Link>
              )}
              {active.contratoId && (
                <Link href={`/dashboard/estadia/${active.contratoId}`} className="text-xs font-semibold text-forest underline" data-testid="conversa-abrir-estadia">
                  Abrir a página da estadia
                </Link>
              )}
            </div>
          </header>
          {/* Prompt 43, item 5: o contexto da conversa no topo — estadia, pedido ou imóvel, com foto e datas. */}
          {(active.property || active.pedidoParceiroId) && (
            <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3 md:px-4" data-testid="conversa-contexto">
              {active.foto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={active.foto} alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0">
                <p className="text-xs text-muted" data-testid="conversa-contexto-tipo">
                  {active.contratoId ? "Estadia" : active.pedidoParceiroId ? "Pedido de serviço" : "Imóvel"}
                </p>
                {active.property && <p className="truncate text-sm font-semibold text-ink">{active.property}</p>}
                {active.periodo && (
                  <p className="text-xs text-muted" data-testid="conversa-contexto-datas">
                    {active.periodo}
                  </p>
                )}
              </div>
            </div>
          )}
          {!demo && active.propertyId && active.otherId && (
            <VisitaNaConversa propertyId={active.propertyId} outroId={active.otherId} />
          )}
          {/* Prompt 62-A: a visita de avaliação do imóvel ocupado, para o morador concordar ou pedir outro horário. */}
          {!demo && active.contratoId && active.propertyId && (
            <AvaliacaoNaConversaCartao propertyId={active.propertyId} onPreferirOutro={() => setDraft("Prefiro outro horário para a visita de avaliação do imóvel. Posso em: ")} />
          )}
          {/* Ficha do pet da candidatura: só aparece para o DONO daquela candidatura (o servidor confere). */}
          {!demo && active.propertyId && active.otherId && (
            <FichaPetCandidatura
              key={`pet-${active.id}`}
              alvo={{ propertyId: active.propertyId, tenantId: active.otherId }}
              className="border-b border-line bg-white px-4 py-3"
            />
          )}
          <div className="flex-1 space-y-3 overflow-y-auto bg-surface-2 p-4">
            {active.messages.map((m) => (
              <div key={m.id} className={cn("flex flex-col gap-1", m.from === "me" ? "items-end" : "items-start")}>
                <span
                  className={cn(
                    "max-w-[75%] rounded-xl px-4 py-2 text-sm",
                    m.from === "me"
                      ? "rounded-br-lg bg-forest text-white"
                      : "rounded-bl-lg bg-white text-ink"
                  )}
                >
                  {m.text}
                  {m.propostaId && (
                    <Link
                      href={`/dashboard/propostas/${m.propostaId}`}
                      className={cn("mt-2 block rounded-lg px-3 py-2 text-center text-xs font-semibold", m.from === "me" ? "bg-white/15 text-white" : "bg-sage-100 text-forest")}
                      data-testid="cartao-proposta"
                    >
                      Ver proposta
                    </Link>
                  )}
                </span>
                {m.from !== "me" && !active.contratoFechado && pareceDadoBancario(m.text) && (
                  <span data-testid="alerta-antigolpe-mensagem" role="alert" className="max-w-[75%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {AVISO_ANTIGOLPE_ALERTA}{" "}
                    <Link href="/seguranca" className="font-semibold underline">Ver dicas</Link>
                  </span>
                )}
              </div>
            ))}
          </div>
          {guardNotice && (
            <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              {GUARD_NOTICE}
            </p>
          )}
          {docBloqueado && (
            <p role="alert" className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800" data-testid="mensagens-documento-bloqueado">
              {DOCUMENTO_BLOQUEADO}
              {active.contratoId ? (
                <>
                  {": "}
                  <Link href={`/dashboard/estadia/${active.contratoId}/ocupantes`} className="font-semibold underline">
                    abrir Ocupantes
                  </Link>
                </>
              ) : (
                "."
              )}
            </p>
          )}
          {/* Conversa com imóvel = entre pessoas; "Suporte" é a equipe, não há o que denunciar. */}
          {active.papel !== "suporte" && <DenunciarConversa key={active.id} conversationId={active.id} demo={demo} />}
          {/* Prompt 58: aviso fixo — documento não circula pelo chat. */}
          <p className="border-t border-sage-200 px-4 pt-2 text-xs text-ink/60" data-testid="mensagens-aviso-documentos">
            {AVISO_DOCUMENTOS}
          </p>
          {rapidaBloqueada && (
            <p role="alert" className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800" data-testid="resposta-rapida-bloqueada">
              {MSG_CONTATO_BLOQUEADO}
            </p>
          )}
          {!demo && active.papel === "proprietario" && active.propertyId && (
            <RespostasRapidasConversa
              key={active.id}
              propertyId={active.propertyId}
              onEscolher={(r) => {
                setDraft(r.texto);
                setDeRapida(true);
                setRapidaBloqueada(false);
              }}
            />
          )}
          <form onSubmit={submit} className="flex items-center gap-2 border-t border-sage-200 p-3">
            <input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (!e.target.value) setDeRapida(false);
              }}
              data-testid="mensagem-campo"
              placeholder="Escreva uma mensagem..."
              className="flex-1 rounded-full border border-sage-200 px-4 py-3 text-sm outline-none focus:border-sage"
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

/**
 * Prompt 23: a visita (vídeo ou presencial) em aberto entre as duas pessoas aparece no topo da conversa, com as mesmas
 * ações do painel Visitas (confirmar, propor outro horário, recusar com motivo; o morador aceita o novo horário).
 */
function VisitaNaConversa({ propertyId, outroId }: { propertyId: string; outroId: string }) {
  // O cartão guarda de qual conversa (imóvel + pessoa) ele é: trocar de conversa nunca mostra o da anterior,
  // nem enquanto a resposta nova não chega (QA 21/10, "cartão residual nas Conversas").
  const chave = `${propertyId}:${outroId}`;
  const [carregada, setCarregada] = useState<{ chave: string; visita: Awaited<ReturnType<typeof visitaDaConversa>> } | null>(null);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let alive = true;
    visitaDaConversa(propertyId, outroId)
      .then((v) => {
        if (alive) setCarregada({ chave: `${propertyId}:${outroId}`, visita: v });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [propertyId, outroId, versao]);
  const visita = carregada?.chave === chave ? carregada.visita : null;
  const { papel, ...v } = visita ?? { papel: "morador" as const };
  // A caixa fica SEMPRE montada (sem chave por conversa): trocar de conversa só troca o conteúdo dela. O lab mostrou
  // que, remontando o cartão por conversa, o React apagava o componente da anterior mas o nó dele ficava na seção (t270).
  return (
    <div data-conversa-visita-caixa={chave} hidden={!visita}>
      {visita && (
        <div className="border-b border-line bg-white px-4 py-3" data-testid="conversa-visita" data-imovel={propertyId} data-visita={visita.id}>
          <CartaoVisita key={`${chave}-${visita.id}-${visita.status}`} v={v as Omit<NonNullable<typeof visita>, "papel">} papel={papel} compacto onMudou={() => setVersao((n) => n + 1)} />
        </div>
      )}
    </div>
  );
}
