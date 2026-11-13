"use client";

import { marcarConversaAberta } from "@/lib/data/conversa-aberta-actions";
import { FichaPetCandidatura } from "@/components/pets/ficha-pet-candidatura";
import { SeloLinkedin } from "@/components/confianca/selo-linkedin";
import { SeloVinculo } from "@/components/confianca/selo-vinculo";
import { useEffect, useRef, useState } from "react";
import { Send, ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import Link from "next/link";
import { AvisoAntigolpe } from "@/components/seguranca/aviso-antigolpe";
import { AVISO_ANTIGOLPE_ALERTA, pareceDadoBancario } from "@/lib/seguranca/antigolpe";
import { FileiraRolavel } from "@/components/ui/fileira-rolavel";
import { DenunciarConversa } from "@/components/mensagens/denunciar-conversa";
import { Avatar } from "@/components/ui/avatar";
import { sendMessage } from "@/lib/data/actions";
import { enviarMensagemDoPedido } from "@/lib/parceiros/pedido-actions";
import { getAvatarUrl } from "@/lib/data/avatar-actions";
import type { Conversation } from "@/lib/data/messages";
import { EmergenciaChegada } from "@/components/estadia/emergencia-chegada";
import { GUARD_NOTICE, DOCUMENTO_BLOQUEADO, AVISO_DOCUMENTOS } from "@/lib/messages/contact-guard";
import { avisoAntesDeEnviar, previaAoDigitar } from "@/lib/messages/aviso-envio";
import { ROTA_ENVIAR_ANEXO, podeAnexar, tipoNaTela, validarAnexoNaTela } from "@/lib/messages/anexo-tela";
import { AnexoNaMensagem, BotaoAnexar, PreviaAnexo, semLocalizacao } from "@/components/mensagens/anexo-conversa";
import { useDemoMode, DemoBadge } from "@/lib/demo/demo-mode";
import { DEMO_CONVERSATIONS } from "@/lib/demo/seed";
import { FILTROS, PRAZOS_ADIAR, adiarAte, contarPorFiltro, filtrarConversas, separarAdiadas, estaAdiada, type Filtro, type PrazoAdiar } from "@/lib/mensagens-filtros";
import { adiarConversa, retomarConversa } from "@/lib/data/conversa-adiar-actions";
import { cn } from "@/lib/utils";
import { CartaoVisita } from "@/components/visitas/cartao-visita";
import { visitaDaConversa } from "@/lib/data/visitas-video-actions";
import { AvaliacaoNaConversaCartao } from "@/components/vistoria/avaliacao-na-conversa";
import { RespostasRapidasConversa } from "@/components/mensagens/respostas-rapidas-conversa";
import { MSG_CONTATO_BLOQUEADO, temContato } from "@/lib/respostas/regras";
import { TEXTO_MENSAGENS_VAZIO, TITULO_MENSAGENS_VAZIO } from "@/lib/mensagens-vazio";
import { TEXTO_CONVERSA_NAO_ENCONTRADA, TEXTO_CONVERSA_NOVA, conversaInicial } from "@/lib/mensagens/conversa-pedida";
import { semQuedaDeRede } from "@/lib/erro-de-rede";
import { horaDaBolha } from "@/lib/mensagens/hora-da-bolha";
import { EVENTO_CONTADORES } from "@/lib/painel/contadores";

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
  // E200: conversa pedida que não está na lista não abre nenhuma — nunca a primeira da lista (de outra pessoa).
  const [activeId, setActiveId] = useState<string>(conversaInicial(pedida, initial.map((c) => c.id)) ?? "");
  const [naoEncontrada, setNaoEncontrada] = useState(!demo && !!pedida && !existe);
  // E445 (item 3): aviso de termo ofensivo — a pessoa revisa ou envia mesmo assim (vai para a fila de moderação).
  const [ofensaPendente, setOfensaPendente] = useState<{ envio: Parameters<typeof sendMessage>[0]; aviso: string } | null>(null);
  const [draft, setDraft] = useState("");
  // Prompt 55-E2: o texto do campo veio de uma resposta rápida? Então contato direto BLOQUEIA (não mascara).
  const [deRapida, setDeRapida] = useState(false);
  const [rapidaBloqueada, setRapidaBloqueada] = useState(false);
  const [filtro, setFiltro] = useState<Filtro | "adiadas">("todas");
  // E721: o menu "Adiar" da conversa aberta e o erro da ação.
  const [menuAdiar, setMenuAdiar] = useState(false);
  const [erroAdiar, setErroAdiar] = useState<string | null>(null);
  // Fotos das conversas (map conversationId → URL). O SERVIDOR decide: foto do
  // proprietário é pública; foto do morador só vem se a relação foi aceita.
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
            // Foto da outra pessoa: sem conexão, fica sem foto (a inicial aparece), sem rejeitar a lista inteira.
            const { url } = await getAvatarUrl({ targetId: c.otherId as string, propertyId: c.propertyId }).catch(() => ({ url: null }));
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
  // E445 item 2 + E585: com contato/link no texto, o aviso e a prévia mascarada aparecem AO DIGITAR (como na proposta),
  // antes de qualquer envio. "Editar" recolhe o aviso para aquele rascunho; mexer no texto (ou tentar enviar) reabre.
  const [avisoFechadoPara, setAvisoFechadoPara] = useState<string | null>(null);
  const previaContato = previaAoDigitar(draft, { deRapida });
  const avisoAberto = previaContato !== null && avisoFechadoPara !== draft;
  const campoRef = useRef<HTMLInputElement>(null);
  // E445 item 5: foto ou PDF escolhido, com a prévia antes de enviar.
  const [anexo, setAnexo] = useState<{ arquivo: File; previaUrl: string | null } | null>(null);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [erroAnexo, setErroAnexo] = useState<string | null>(null);
  // No mobile, alterna entre lista e conversa (master-detail). No desktop, ambos.
  const [mobileView, setMobileView] = useState<"list" | "chat">(existe ? "chat" : "list");

  // E721: conversa adiada sai de "Todas" e dos chips de papel e fica em "Adiadas" (até o prazo ou até a outra parte escrever).
  const { ativas, adiadas } = separarAdiadas(conversations);
  const contagem = contarPorFiltro(ativas);
  const visiveis = filtro === "adiadas" ? adiadas : filtrarConversas(ativas, filtro);
  // A conversa aberta acompanha o chip: se ela saiu do filtro, abre a primeira que sobrou. E168: filtro sem conversa =
  // painel da direita vazio (nunca a conversa de outro filtro).
  const active = naoEncontrada ? undefined : (visiveis.find((c) => c.id === activeId) ?? visiveis[0]);

  // Prompt 44: com a conversa aberta (e a aba visível), a próxima mensagem dela não vira push no celular. Renova a cada
  // 5 min enquanto ela fica na tela (a regra do push olha os últimos 10 min).
  const conversaAbertaId = active?.id;
  useEffect(() => {
    if (demo || !conversaAbertaId) return;
    const marcar = () => {
      if (document.visibilityState !== "visible") return;
      // E481: lida a conversa, a contagem dela zera na lista e o sino relê na hora (não no ciclo de 1 minuto).
      setConversations((cs) => cs.map((c) => (c.id === conversaAbertaId && c.naoLidas ? { ...c, naoLidas: 0 } : c)));
      marcarConversaAberta(conversaAbertaId)
        .then(() => {
          window.dispatchEvent(new Event(EVENTO_CONTADORES));
        })
        .catch(() => {});
    };
    marcar();
    const t = setInterval(marcar, 5 * 60_000);
    document.addEventListener("visibilitychange", marcar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", marcar);
    };
  }, [demo, conversaAbertaId]);

  // E721: adiar/retomar a conversa aberta. O estado muda na hora na tela; se o servidor recusar, volta e mostra o erro.
  async function adiar(id: string, prazo: PrazoAdiar) {
    setErroAdiar(null);
    setMenuAdiar(false);
    const antes = conversations;
    const ate = adiarAte(prazo);
    const agora = new Date().toISOString();
    setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, adiadaEm: agora, adiadaAte: ate } : c)));
    if (demo) return;
    const r = await adiarConversa(id, prazo).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
    if (!r.ok) {
      setConversations(antes);
      setErroAdiar(r.erro);
    }
  }
  async function retomar(id: string) {
    setErroAdiar(null);
    const antes = conversations;
    setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, adiadaEm: null, adiadaAte: null } : c)));
    if (demo) return;
    const r = await retomarConversa(id).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
    if (!r.ok) {
      setConversations(antes);
      setErroAdiar(r.erro);
    }
  }

  function openConversation(id: string) {
    setMenuAdiar(false);
    setErroAdiar(null);
    setNaoEncontrada(false);
    setAvisoFechadoPara(null);
    limparAnexo();
    setErroAnexo(null);
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
    const aviso = avisoAntesDeEnviar(draft);
    setDocBloqueado(aviso.tipo === "documento");
    if (aviso.tipo === "documento") return;
    // E445 item 2: primeiro o aviso com a prévia; só o botão "Enviar mesmo assim" envia (Enter de novo não confirma).
    // E585: Enter ou o botão redondo nunca enviam contato — reabrem o aviso; só "Enviar mesmo assim" envia (mascarado).
    if (aviso.tipo === "confirmar") return setAvisoFechadoPara(null);
    await enviar(aviso.texto, false);
  }

  function limparAnexo() {
    setAnexo((a) => {
      if (a?.previaUrl) URL.revokeObjectURL(a.previaUrl);
      return null;
    });
  }

  async function escolherAnexo(f: File) {
    setErroAnexo(null);
    limparAnexo();
    const erro = validarAnexoNaTela(f);
    if (erro) return setErroAnexo(erro);
    try {
      const arquivo = await semLocalizacao(f);
      setAnexo({ arquivo, previaUrl: arquivo.type === "application/pdf" ? null : URL.createObjectURL(arquivo) });
    } catch {
      setErroAnexo("Não foi possível ler esta foto. Tente outra.");
    }
  }

  async function enviarAnexo() {
    if (!anexo || !active?.otherId) return;
    setEnviandoAnexo(true);
    setErroAnexo(null);
    const dados = new FormData();
    dados.set("receiverId", active.otherId);
    if (active.propertyId) dados.set("propertyId", active.propertyId);
    dados.set("file", anexo.arquivo);
    // Rede travada não deixa a prévia em "Enviando…" para sempre: 60 s e o aviso de tentar de novo.
    const r = await fetch(ROTA_ENVIAR_ANEXO, { method: "POST", body: dados, credentials: "same-origin", signal: AbortSignal.timeout(60_000) }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { ok?: boolean; error?: string; anexoId?: string; messageId?: string; mime?: string } | null;
    setEnviandoAnexo(false);
    const tipo = j?.mime ? tipoNaTela(j.mime) : null;
    if (!r?.ok || !j?.ok || !j.anexoId || !j.messageId || !tipo) return setErroAnexo(j?.error ?? "Não foi possível enviar o anexo agora. Tente de novo.");
    const texto = tipo === "pdf" ? "Anexo: PDF enviado" : "Anexo: foto enviada";
    const conversa = active.id;
    setConversations((prev) =>
      prev.map((c) => (c.id === conversa ? { ...c, preview: texto, messages: [...c.messages, { id: j.messageId!, from: "me", text: texto, anexo: { id: j.anexoId!, tipo }, enviadaEm: new Date().toISOString() }] } : c))
    );
    limparAnexo();
  }

  async function enviar(text: string, masked: boolean) {
    if (!active) return;
    setAvisoFechadoPara(null);
    setGuardNotice(masked);
    setDraft("");
    const usouRapida = deRapida;
    setDeRapida(false);
    // Atualização otimista
    setConversations((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? { ...c, preview: text, messages: [...c.messages, { id: `tmp-${Date.now()}`, from: "me", text, enviadaEm: new Date().toISOString() }] }
          : c
      )
    );
    // Persiste (Supabase quando configurado). Em modo demonstração NUNCA
    // grava: a conversa é fictícia e o envio fica só na tela.
    if (!demo) {
      // Conversa de pedido de serviço (Prompt 31b): o servidor confere a parte do pedido e grava na conversa dele.
      if (active.pedidoParceiroId) await semQuedaDeRede(enviarMensagemDoPedido(active.pedidoParceiroId, text));
      else
      {
        const envio = { conversationId: active.id, receiverId: active.otherId, propertyId: active.propertyId, body: text, respostaRapida: usouRapida };
        const r = await semQuedaDeRede(sendMessage(envio));
        // E445 (item 3): termo ofensivo — o servidor avisa ANTES de gravar; só envia com a confirmação da pessoa.
        if (r && typeof r === "object" && "ofensa" in r && r.ofensa) {
          // Não gravou: tira o eco otimista, devolve o texto ao campo e mostra o aviso com "Enviar mesmo assim".
          setConversations((prev) => prev.map((c) => (c.id === active.id ? { ...c, messages: c.messages.filter((m) => !String(m.id).startsWith("tmp-") || m.text !== text) } : c)));
          setDraft(text);
          setOfensaPendente({ envio, aviso: r.error ?? "" });
        }
      }
    }
  }

  // E445: a última mensagem minha que o destinatário já leu (o "Visto" aparece só nela).
  const ultimaMinhaVista = active ? [...active.messages].reverse().find((m) => m.from === "me" && m.visto)?.id : undefined;

  if (conversations.length === 0) {
    return (
      <>
        <PageTitle title="Mensagens" />
        {/* Prompt 48: sem ilustração; diz como a conversa funciona e o próximo passo. */}
        <div className="rounded-xl border border-line bg-white p-6 sm:p-8" data-testid="mensagens-vazio">
          <h2 className="font-title text-lg font-semibold text-ink">{TITULO_MENSAGENS_VAZIO}</h2>
          <p className="mt-2 max-w-md text-sm text-muted" data-testid="mensagens-vazio-texto">
            {TEXTO_MENSAGENS_VAZIO}
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
      {/* E248: os filtros que não cabem no celular ("Como mor…") ganham o "›" na borda — dá para ver que há mais. */}
      <FileiraRolavel role="group" aria-label="Filtrar conversas" classeExterna="mb-3" className="flex gap-2 pb-1">
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
        {/* E721: as conversas adiadas ficam aqui (o chip aparece quando há alguma). */}
        {(adiadas.length > 0 || filtro === "adiadas") && (
          <button
            type="button"
            data-testid="mensagens-filtro-adiadas"
            aria-pressed={filtro === "adiadas"}
            onClick={() => {
              setFiltro("adiadas");
              setMobileView("list");
            }}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
              filtro === "adiadas" ? "border-forest bg-forest text-white" : "border-sage-200 bg-white text-ink hover:bg-surface-2"
            )}
          >
            Adiadas
            <span className={cn("text-xs", filtro === "adiadas" ? "text-white/80" : "text-muted")}>{adiadas.length}</span>
          </button>
        )}
      </FileiraRolavel>
      {naoEncontrada && (
        <p role="status" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="mensagens-conversa-nao-encontrada">
          {TEXTO_CONVERSA_NAO_ENCONTRADA}
        </p>
      )}
      {/* E243/E244: no celular a grade tem UMA coluna do tamanho da tela (minmax(0,1fr)); sem ela, a coluna implícita
          crescia até o texto mais longo (nome do imóvel em uma linha) — o cartão ia a ~534 px e a conversa saía da tela. */}
      <div className="grid h-[75vh] grid-cols-[minmax(0,1fr)] overflow-hidden rounded-xl border border-sage-200 bg-white md:h-[70vh] md:grid-cols-3">
        {/* Lista — no mobile some quando uma conversa está aberta */}
        <aside
          className={cn(
            "min-w-0 border-r border-sage-200 md:col-span-1 md:block",
            mobileView === "chat" && "hidden"
          )}
        >
          {visiveis.length === 0 && (
            <p data-testid="mensagens-filtro-vazio" className="p-6 text-center text-sm text-muted">
              {filtro === "adiadas" ? "Nenhuma conversa adiada." : "Nenhuma conversa neste filtro."}
            </p>
          )}
          {visiveis.map((c) => (
            <button
              key={c.id}
              data-testid="mensagens-conversa"
              data-conversa={c.id}
              data-nao-lidas={c.naoLidas ?? 0}
              onClick={() => openConversation(c.id)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-sage-200 px-4 py-3 text-left transition-colors",
                active?.id === c.id ? "bg-blue-50 md:bg-blue-50" : "hover:bg-surface-2"
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
                <span className="flex min-w-0 items-center gap-2">
                  {/* E481: não lida em destaque (nome em negrito e a contagem); o acabamento visual fica com a Pista A. */}
                  <span className={cn("truncate text-ink", c.naoLidas ? "font-semibold" : "font-medium")}>{c.name}</span>
                  {!!c.naoLidas && (
                    <span className="shrink-0 rounded-full bg-forest px-2 text-xs font-semibold text-white" data-testid="mensagens-nao-lidas" aria-label={`${c.naoLidas} não lidas`}>
                      {c.naoLidas}
                    </span>
                  )}
                </span>
                {(c.property || c.periodo) && (
                  <span className="truncate text-xs text-muted">{[c.property, c.periodo].filter(Boolean).join(" · ")}</span>
                )}
                <span className="line-clamp-1 text-sm text-muted">{c.preview}</span>
              </span>
            </button>
          ))}
        </aside>

        {/* Chat — no mobile some quando se está vendo a lista */}
        {!active ? (
          <section className="hidden flex-col items-center justify-center gap-2 p-8 text-center md:col-span-2 md:flex" data-testid="mensagens-detalhe-vazio">
            <p className="font-semibold text-ink">Nenhuma conversa aberta</p>
            <p className="max-w-sm text-sm text-muted">
              {naoEncontrada ? "Escolha uma conversa da lista." : "Não há conversa neste filtro. Escolha outro filtro para ver as suas conversas."}
            </p>
          </section>
        ) : (
        <section
          className={cn(
            "flex min-w-0 flex-col md:col-span-2 md:flex",
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
              {active.vinculoDominio && <SeloVinculo dominio={active.vinculoDominio} />}
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
            {/* E721: "Adiar" sempre à vista no cabeçalho da conversa; adiada, vira "Retomar" com o prazo. */}
            <div className="relative ml-auto shrink-0">
              {estaAdiada(active) ? (
                <button
                  type="button"
                  data-testid="conversa-retomar"
                  onClick={() => void retomar(active.id)}
                  className="inline-flex min-h-11 items-center rounded-lg border border-sage-200 bg-white px-3 text-sm font-semibold text-ink hover:bg-surface-2"
                >
                  Retomar
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="conversa-adiar"
                  aria-expanded={menuAdiar}
                  onClick={() => setMenuAdiar((v) => !v)}
                  className="inline-flex min-h-11 items-center rounded-lg border border-sage-200 bg-white px-3 text-sm font-semibold text-ink hover:bg-surface-2"
                >
                  Adiar
                </button>
              )}
              {menuAdiar && !estaAdiada(active) && (
                <div role="menu" data-testid="conversa-adiar-menu" className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-sage-200 bg-white p-1">
                  {PRAZOS_ADIAR.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitem"
                      data-testid={`conversa-adiar-${p.id}`}
                      onClick={() => void adiar(active.id, p.id)}
                      className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm text-ink hover:bg-surface-2"
                    >
                      Adiar por {p.rotulo}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </header>
          {estaAdiada(active) && (
            <p role="status" data-testid="conversa-adiada-aviso" className="border-b border-line bg-surface-2 px-4 py-2 text-xs text-muted">
              Adiada até {new Date(active.adiadaAte as string).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}. Se a outra parte escrever, ela volta para a lista. Só você vê isso.
            </p>
          )}
          {erroAdiar && (
            <p role="alert" data-testid="conversa-adiar-erro" className="border-b border-line bg-amber-50 px-4 py-2 text-xs text-amber-900">
              {erroAdiar}
            </p>
          )}
          {/* Prompt 43, item 5: o contexto da conversa no topo — estadia, pedido ou imóvel, com foto e datas. */}
          {(active.property || active.pedidoParceiroId) && (
            <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3 md:px-4" data-testid="conversa-contexto">
              {active.foto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={active.foto} alt="" loading="lazy" className="h-16 w-20 shrink-0 rounded-lg object-cover" data-testid="conversa-contexto-foto" />
              )}
              <div className="min-w-0">
                <p className="text-xs text-muted" data-testid="conversa-contexto-tipo">
                  {active.contratoId ? "Estadia" : active.pedidoParceiroId ? "Pedido de serviço" : "Imóvel"}
                </p>
                {/* Conformidade fina (01/11, mockup morador-mensagens): o imóvel da conversa em destaque (foto maior, título um passo acima). */}
                {active.property && <p className="truncate font-title text-base font-semibold text-ink">{active.property}</p>}
                {active.periodo && (
                  <p className="text-xs text-muted" data-testid="conversa-contexto-datas">
                    {active.periodo}
                  </p>
                )}
              </div>
            </div>
          )}
          {/* E664: no dia da entrada, o morador aciona um aviso urgente ao proprietário (a Viva intermedia; sem contato). */}
          {!demo && active.emergenciaChegadaContratoId && <EmergenciaChegada key={`emerg-${active.id}`} contratoId={active.emergenciaChegadaContratoId} />}
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
            {active.messages.length === 0 && (
              <p className="py-6 text-center text-sm text-muted" data-testid="conversa-nova-vazia">
                {TEXTO_CONVERSA_NOVA}
              </p>
            )}
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
                  {m.anexo ? <AnexoNaMensagem anexo={m.anexo} minha={m.from === "me"} /> : m.text}
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
                {/* E484: a hora de envio de cada mensagem (fuso de Brasília). */}
                {horaDaBolha(m.enviadaEm) && (
                  <span className="text-[11px] text-muted" data-testid="mensagem-hora" suppressHydrationWarning>
                    {horaDaBolha(m.enviadaEm)}
                  </span>
                )}
                {m.from !== "me" && !active.contratoFechado && pareceDadoBancario(m.text) && (
                  <span data-testid="alerta-antigolpe-mensagem" role="alert" className="max-w-[75%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {AVISO_ANTIGOLPE_ALERTA}{" "}
                    <Link href="/seguranca" className="font-semibold underline">Ver dicas</Link>
                  </span>
                )}
                {/* E445 (item 4): "Visto" só na última mensagem minha já lida pelo destinatário. */}
                {m.from === "me" && m.visto && m.id === ultimaMinhaVista && (
                  <span className="text-[11px] text-muted" data-testid="mensagem-vista">
                    Visto
                  </span>
                )}
              </div>
            ))}
          </div>
          {ofensaPendente && (
            <div role="alert" data-testid="aviso-ofensa" className="flex flex-wrap items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
              <span className="flex-1">{ofensaPendente.aviso}</span>
              <button type="button" className="min-h-11 font-semibold underline" onClick={() => setOfensaPendente(null)}>
                Revisar a mensagem
              </button>
              <button
                type="button"
                className="min-h-11 font-semibold underline"
                onClick={async () => {
                  const envio = ofensaPendente.envio;
                  setOfensaPendente(null);
                  setDraft("");
                  const r = await semQuedaDeRede(sendMessage({ ...envio, enviarMesmoAssim: true }));
                  if (r.ok) setConversations((prev) => prev.map((c) => (c.id === envio.conversationId ? { ...c, preview: envio.body, messages: [...c.messages, { id: `tmp-${Date.now()}`, from: "me", text: envio.body, enviadaEm: new Date().toISOString() }] } : c)));
                }}
              >
                Enviar mesmo assim
              </button>
            </div>
          )}
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
          {/* E245: chave PRÓPRIA (antes key={active.id}, a mesma das Respostas rápidas logo abaixo — irmãos com a mesma
              chave fazem o React duplicar nós a cada nova renderização: "Denunciar" aparecia 2, 3, 4 vezes). */}
          {active.papel !== "suporte" && <DenunciarConversa key={`denuncia-${active.id}`} conversationId={active.id} demo={demo} />}
          {/* Prompt 58: aviso fixo — documento não circula pelo chat. */}
          <p className="border-t border-sage-200 px-4 pt-2 text-xs text-muted" data-testid="mensagens-aviso-documentos">
            {AVISO_DOCUMENTOS}
          </p>
          {rapidaBloqueada && (
            <p role="alert" className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800" data-testid="resposta-rapida-bloqueada">
              {MSG_CONTATO_BLOQUEADO}
            </p>
          )}
          {!demo && active.papel === "proprietario" && active.propertyId && (
            <RespostasRapidasConversa
              key={`rapidas-${active.id}`}
              propertyId={active.propertyId}
              onEscolher={(r) => {
                setDraft(r.texto);
                setDeRapida(true);
                setRapidaBloqueada(false);
              }}
            />
          )}
          {avisoAberto && (
            <div role="alert" className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900" data-testid="aviso-antes-de-enviar">
              <p>{GUARD_NOTICE}</p>
              <p className="mt-2 font-semibold">Vai assim:</p>
              <p className="mt-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-ink [overflow-wrap:anywhere]" data-testid="aviso-previa">
                {previaContato}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAvisoFechadoPara(draft);
                    campoRef.current?.focus();
                  }}
                  className="min-h-11 rounded-full border border-sage-200 bg-white px-4 text-sm font-semibold text-ink hover:border-forest"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => previaContato && void enviar(previaContato, true)}
                  className="min-h-11 rounded-full border border-forest bg-white px-4 text-sm font-semibold text-forest hover:bg-sage-100"
                >
                  Enviar mesmo assim
                </button>
              </div>
            </div>
          )}
          {erroAnexo && (
            <p role="alert" className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900" data-testid="anexo-erro">
              {erroAnexo}
            </p>
          )}
          {anexo && <PreviaAnexo arquivo={anexo.arquivo} previaUrl={anexo.previaUrl} enviando={enviandoAnexo} onEnviar={() => void enviarAnexo()} onCancelar={limparAnexo} />}
          <form onSubmit={submit} className="flex items-center gap-2 border-t border-sage-200 p-3">
            {podeAnexar(active, demo) && <BotaoAnexar onEscolher={(f) => void escolherAnexo(f)} desligado={enviandoAnexo} />}
            <input
              value={draft}
              ref={campoRef}
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
              // E585: com contato no rascunho o botão muda (âmbar) e não envia direto: abre o aviso com a prévia.
              data-contato={previaContato ? "1" : undefined}
              title={previaContato ? "Telefone, e-mail ou link serão ocultados — revise o aviso" : undefined}
              className={cn("grid h-11 w-11 place-items-center rounded-full text-white", previaContato ? "bg-amber-600 hover:bg-amber-700" : "bg-forest hover:bg-forest-700")}
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
        )}
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
          <CartaoVisita key={`${chave}-${visita.id}-${visita.status}`} v={v as Omit<NonNullable<typeof visita>, "papel">} papel={papel} compacto hrefDetalhe={`/dashboard/visitas/${visita.id}`} onMudou={() => setVersao((n) => n + 1)} />
        </div>
      )}
    </div>
  );
}
