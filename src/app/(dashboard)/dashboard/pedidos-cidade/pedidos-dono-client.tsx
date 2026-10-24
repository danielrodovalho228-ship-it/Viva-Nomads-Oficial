"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Megaphone, Home, Plus, Info, Check, Sparkles, EyeOff, Undo2, MessageCircle, UserRound, ShieldCheck, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/dashboard/primitives";
import { cn } from "@/lib/utils";
import { rotuloPreco } from "@/lib/cartao-preco";
import { contemContato, CONTATO_AVISO, motivoParaDono } from "@/lib/pedidos/pedidos";
import { dataPedidoBR, textoBairros, textoFaixaValor, textoNecessidades, textoInternetPedido, textoPortePet, textoQuartos } from "@/lib/pedidos/campos";
import { ABAS_DONO, MENSAGEM_OFERTA_PADRAO, STATUS_CONVERSA, type AbaDono } from "@/lib/pedidos/mural-dono";
import { chaveCidade } from "@/lib/cidades";
import { ignorarPedido, oferecerImovel, voltarParaNovos } from "@/lib/data/pedidos-actions";
import type { PedidoParaDono, PropriedadeMinima } from "@/lib/data/pedidos-actions";

const ORDEM_SITUACAO = { compativel: 0, quase: 1, demais: 2 } as const;

/**
 * Pedidos de moradia — visão do PROPRIETÁRIO (Prompt 30, item 5). Três abas: "Novos para você", "Respondidos" (com o
 * status da conversa) e "Ignorados". Ações: "Oferecer um imóvel" (imóvel compatível + mensagem padrão; o inquilino
 * vê o cartão do anúncio) e "Ignorar" (motivo opcional). Nome e foto do inquilino só depois que ele aceita a oferta;
 * contato, nunca.
 */
export function PedidosDonoClient({ pedidos, myProperties }: { pedidos: PedidoParaDono[]; myProperties: PropriedadeMinima[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const pedidoDoLink = params.get("pedido");
  const imovelDoLink = params.get("imovel");
  const [aba, setAba] = useState<AbaDono>("novos");
  const [aberto, setAberto] = useState<{ id: string; modo: "oferecer" | "ignorar" } | null>(null);

  // Link do e-mail/resumo ("Responder"): abre o pedido já oferecendo o imóvel.
  useEffect(() => {
    if (!pedidoDoLink) return;
    const p = pedidos.find((x) => x.id === pedidoDoLink);
    if (!p) return;
    /* eslint-disable react-hooks/set-state-in-effect -- abre o pedido do link uma vez */
    setAba(p.aba);
    if (p.aba === "novos") setAberto({ id: p.id, modo: "oferecer" });
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoDoLink]);

  const contagem = (a: AbaDono) => pedidos.filter((p) => p.aba === a).length;
  const lista = pedidos
    .filter((p) => p.aba === aba)
    .sort((a, b) => ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao] || (b.compat_nota ?? -1) - (a.compat_nota ?? -1) || b.criado_em.localeCompare(a.criado_em));
  const vazio: Record<AbaDono, string> = {
    novos: "Nenhum pedido novo para você agora. Quando alguém publicar um pedido na cidade dos seus imóveis, ele aparece aqui.",
    respondidos: "Você ainda não ofereceu imóvel a nenhum pedido.",
    ignorados: "Nenhum pedido ignorado.",
  };

  return (
    <div>
      <PageTitle
        title="Pedidos de moradia"
        subtitle="Quem procura casa conta o que precisa. Ofereça um imóvel seu — a conversa acontece pela plataforma."
      />

      <div className="mb-4 flex max-w-full overflow-x-auto" role="tablist" aria-label="Pedidos" data-testid="abas-pedidos-dono">
        <div className="inline-flex rounded-full bg-surface-2 p-1 text-sm">
          {ABAS_DONO.map((a) => (
            <button
              key={a.chave}
              type="button"
              role="tab"
              aria-selected={aba === a.chave}
              onClick={() => setAba(a.chave)}
              data-testid={`aba-${a.chave}`}
              className={cn("whitespace-nowrap rounded-full px-3 py-2 font-medium transition-colors sm:px-4", aba === a.chave ? "bg-forest text-white" : "text-muted")}
            >
              {a.rotulo} (<span data-testid={`aba-${a.chave}-total`}>{contagem(a.chave)}</span>)
            </button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center" data-testid="pedidos-dono-vazio">
          <Megaphone className="mx-auto h-10 w-10 text-forest" />
          <p className="mx-auto mt-3 max-w-md text-sm text-muted">{vazio[aba]}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {lista.map((p) => {
            const naCidade = myProperties.filter((m) => chaveCidade(m.city) === chaveCidade(p.cidade));
            const preferido = p.id === pedidoDoLink && imovelDoLink ? imovelDoLink : p.compat_imovel_id;
            const opcoes = [...naCidade.filter((m) => m.id === preferido), ...naCidade.filter((m) => m.id !== preferido)];
            return (
              <article key={p.id} className="relative min-w-0 overflow-hidden rounded-xl border border-line bg-white p-4 pl-4 sm:p-4 sm:pl-6" data-testid="pedido-dono-cartao" data-pedido={p.id}>
                <span className="absolute inset-y-0 left-0 w-1.5 bg-gold" aria-hidden />
                <CabecalhoInquilino p={p} />

                <ul className="mt-3 flex flex-wrap gap-2" data-testid="pedido-selos">
                  {p.selos.map((s) => (
                    <li
                      key={s.codigo}
                      data-testid={`selo-${s.codigo}`}
                      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium", s.ok ? "bg-sage-100 text-forest" : "bg-amber-50 text-amber-900")}
                    >
                      {s.codigo === "email" ? <Mail className="h-3 w-3" aria-hidden /> : s.codigo === "identidade" ? <ShieldCheck className="h-3 w-3" aria-hidden /> : <Phone className="h-3 w-3" aria-hidden />}
                      {s.texto}
                    </li>
                  ))}
                </ul>

                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <Meta rotulo="Cidade" valor={`${p.cidade}${p.uf ? `/${p.uf}` : ""}`} />
                  <Meta rotulo="Bairros" valor={textoBairros(p.bairros)} />
                  <Meta rotulo="Entrada" valor={dataPedidoBR(`${p.data_inicio}T12:00:00Z`)} />
                  <Meta rotulo="Período" valor={`${p.prazo_meses} ${p.prazo_meses === 1 ? "mês" : "meses"}`} />
                  <Meta rotulo="Valor mensal" valor={textoFaixaValor(p.orcamento_min, p.orcamento_mensal)} testid="pedido-faixa" />
                  <Meta rotulo="Quartos" valor={textoQuartos(p.quartos_min)} />
                  <Meta rotulo="Pessoas" valor={String(p.qtd_ocupantes)} />
                  <Meta rotulo="Expira em" valor={dataPedidoBR(p.expira_em)} />
                </dl>
                {(p.necessidades.length > 0 || p.pets || p.criancas || !!p.internet_min_mbps) && (
                  <p className="mt-2 text-xs text-muted" data-testid="pedido-necessidades">
                    {[...textoNecessidades(p.necessidades), textoInternetPedido(p.internet_min_mbps), p.pets && textoPortePet(p.porte_pet), p.criancas && "Com crianças"].filter(Boolean).join(" · ")}
                  </p>
                )}
                {p.destino && (
                  <p className="mt-2 text-sm text-ink" data-testid="pedido-destino">
                    Trabalho ou estudo: {p.destino}
                  </p>
                )}
                {p.apresentacao && <p className="mt-3 break-words rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink">{p.apresentacao}</p>}

                {p.situacao !== "demais" && p.compat_imovel_titulo && (
                  <div className={cn("mt-3 rounded-lg px-3 py-2 text-sm", p.situacao === "compativel" ? "bg-sage-100 text-forest" : "bg-amber-50 text-amber-900")}>
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      <Sparkles className="h-4 w-4" aria-hidden />
                      {p.situacao === "compativel" ? "Combina com" : "Quase combina com"} “{p.compat_imovel_titulo}”
                    </p>
                    {p.compat_nota != null && (
                      <details className="mt-1 text-xs" data-testid="pedido-nota">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-medium" aria-label="Como a nota é calculada">
                          Nota {p.compat_nota}/100 <Info className="h-3.5 w-3.5" aria-hidden />
                        </summary>
                        <ul className="mt-1 space-y-1" data-testid="pedido-nota-itens">
                          {p.compat_nota_itens.map((i) => (
                            <li key={i.chave}>
                              {i.rotulo}: {i.pontos} de {i.max}{i.pontos >= i.max ? " (bateu)" : i.pontos === 0 ? " (não bateu)" : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {p.situacao === "compativel" ? (
                      <ul className="mt-1 list-disc pl-4 text-xs">
                        {p.compat_porque.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    ) : (
                      p.compat_motivo && <p className="mt-1 text-xs">Falta pouco: {p.compat_motivo}.</p>
                    )}
                  </div>
                )}

                <div className="mt-4">
                  {p.aba === "respondidos" && p.minhaResposta ? (
                    <div className="space-y-2">
                      <p className="flex items-start gap-2 rounded-lg bg-sage-100 px-3 py-2 text-xs text-forest" data-testid="pedido-status-conversa">
                        <Check className="mt-1 h-4 w-4 shrink-0" aria-hidden />
                        <span>
                          Você ofereceu <strong>{p.minhaResposta.imovelTitulo}</strong> · {STATUS_CONVERSA[p.minhaResposta.status] ?? p.minhaResposta.status}
                          {p.encerrado ? " · o pedido foi encerrado" : ""}
                        </span>
                      </p>
                      {p.minhaResposta.status === "aceita_para_conversa" && (
                        <Link href="/dashboard/mensagens" className="inline-flex items-center gap-2 text-sm font-medium text-forest underline">
                          <MessageCircle className="h-4 w-4" aria-hidden /> Abrir a conversa
                        </Link>
                      )}
                    </div>
                  ) : p.aba === "ignorados" ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted">{p.ignoradoMotivo ? `Ignorado: ${p.ignoradoMotivo}` : "Ignorado"}</p>
                      <BotaoAcao
                        onClick={async () => {
                          const r = await voltarParaNovos(p.id);
                          if (r.ok) router.refresh();
                        }}
                        testid="voltar-novos"
                      >
                        <Undo2 className="h-4 w-4" aria-hidden /> Voltar para Novos
                      </BotaoAcao>
                    </div>
                  ) : naCidade.length === 0 ? (
                    <Link href="/dashboard/imoveis/novo" className="block">
                      <Button variant="ghost" className="w-full">
                        <Plus className="h-4 w-4" /> Cadastrar imóvel em {p.cidade}
                      </Button>
                    </Link>
                  ) : aberto?.id === p.id && aberto.modo === "oferecer" ? (
                    <OfertaForm pedidoId={p.id} opcoes={opcoes} onCancel={() => setAberto(null)} onDone={() => { setAberto(null); router.refresh(); }} />
                  ) : aberto?.id === p.id && aberto.modo === "ignorar" ? (
                    <IgnorarForm pedidoId={p.id} onCancel={() => setAberto(null)} onDone={() => { setAberto(null); router.refresh(); }} />
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button variant="secondary" className="w-full" onClick={() => setAberto({ id: p.id, modo: "oferecer" })} data-testid="oferecer-imovel">
                        <Home className="h-4 w-4" /> Oferecer um imóvel
                      </Button>
                      <Button variant="ghost" className="w-full" onClick={() => setAberto({ id: p.id, modo: "ignorar" })} data-testid="ignorar-pedido">
                        <EyeOff className="h-4 w-4" /> Ignorar
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Antes do aceite: "Inquilino(a)" e o motivo. Depois: nome curto + foto (a identidade só aparece com o aceite). */
function CabecalhoInquilino({ p }: { p: PedidoParaDono }) {
  return (
    <div className="flex items-start gap-3">
      {p.inquilino?.fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada e curta do bucket privado
        <img src={p.inquilino.fotoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sage-100 text-forest" aria-hidden>
          <UserRound className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0">
        <h3 className="font-title text-lg font-semibold text-forest" data-testid="pedido-nome">
          {p.inquilino?.nome ?? "Inquilino(a)"}
        </h3>
        <p className="text-xs text-muted">{motivoParaDono(p.motivo) || "Pedido de moradia"}</p>
        {!p.inquilino && <p className="mt-1 text-[11px] text-muted">Nome e foto aparecem quando a pessoa aceitar a sua oferta.</p>}
      </div>
    </div>
  );
}

function OfertaForm({ pedidoId, opcoes, onCancel, onDone }: { pedidoId: string; opcoes: PropriedadeMinima[]; onCancel: () => void; onDone: () => void }) {
  const [imovelId, setImovelId] = useState(opcoes[0]?.id ?? "");
  const [mensagem, setMensagem] = useState(MENSAGEM_OFERTA_PADRAO);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const contatoNoTexto = mensagem.length > 0 && contemContato(mensagem);
  return (
    <div className="space-y-3 rounded-xl border border-sage-200 p-3" data-testid="oferta-form">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Imóvel</span>
        <select value={imovelId} onChange={(e) => setImovelId(e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-sage" data-testid="oferta-imovel">
          {opcoes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title} · {rotuloPreco({ mensal: m.monthlyPrice }).mes}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Mensagem</span>
        <textarea rows={3} value={mensagem} onChange={(e) => setMensagem(e.target.value.slice(0, 600))} className={cn("w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-sage", contatoNoTexto ? "border-red-300" : "border-line")} />
        {contatoNoTexto && (
          <span className="mt-1 flex items-start gap-2 text-xs text-red-600">
            <Info className="mt-1 h-3.5 w-3.5 shrink-0" /> {CONTATO_AVISO}
          </span>
        )}
      </label>
      <p className="text-xs text-muted">O morador recebe a mensagem com o cartão do anúncio. A conversa é pela plataforma.</p>
      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">{erro}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={enviando}>
          Cancelar
        </Button>
        <Button
          variant="gold"
          disabled={enviando || contatoNoTexto || !imovelId}
          data-testid="oferta-enviar"
          onClick={async () => {
            setErro(null);
            setEnviando(true);
            const r = await oferecerImovel(pedidoId, imovelId, mensagem);
            setEnviando(false);
            if (r.ok) onDone();
            else setErro(r.error ?? "Não foi possível enviar a oferta.");
          }}
        >
          {enviando ? "Enviando…" : "Enviar oferta"}
        </Button>
      </div>
    </div>
  );
}

function IgnorarForm({ pedidoId, onCancel, onDone }: { pedidoId: string; onCancel: () => void; onDone: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="space-y-3 rounded-xl border border-line p-3" data-testid="ignorar-form">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Motivo (opcional)</span>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value.slice(0, 200))} placeholder="Ex.: não tenho imóvel livre nessa data" className="h-11 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-sage" />
      </label>
      <p className="text-xs text-muted">O pedido vai para &quot;Ignorados&quot;. Você pode trazê-lo de volta quando quiser.</p>
      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">{erro}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={enviando}>
          Cancelar
        </Button>
        <Button
          disabled={enviando}
          data-testid="ignorar-confirmar"
          onClick={async () => {
            setErro(null);
            setEnviando(true);
            const r = await ignorarPedido(pedidoId, motivo);
            setEnviando(false);
            if (r.ok) onDone();
            else setErro(r.error ?? "Não foi possível ignorar.");
          }}
        >
          Ignorar pedido
        </Button>
      </div>
    </div>
  );
}

function BotaoAcao({ onClick, testid, children }: { onClick: () => void | Promise<void>; testid: string; children: React.ReactNode }) {
  const [ocupado, setOcupado] = useState(false);
  return (
    <button
      type="button"
      disabled={ocupado}
      data-testid={testid}
      onClick={async () => {
        setOcupado(true);
        await onClick();
        setOcupado(false);
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:border-forest disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function Meta({ rotulo, valor, testid }: { rotulo: string; valor: string; testid?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{rotulo}</dt>
      <dd className="break-words font-medium text-ink" data-testid={testid}>
        {valor}
      </dd>
    </div>
  );
}
