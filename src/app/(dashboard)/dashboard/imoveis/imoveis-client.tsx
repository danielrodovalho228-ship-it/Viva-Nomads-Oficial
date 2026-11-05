"use client";

import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { imovelPublicado } from "@/lib/anuncio/publicados";
import { gruposRascunhosDuplicados, idsRascunhosDuplicados } from "@/lib/anuncio/rascunhos-duplicados";
import { useState } from "react";
import Link from "next/link";
import { Plus, Bath, BedDouble, Home, Handshake, Trash2 } from "lucide-react";
import { selosDaFoto } from "@/lib/cartao-selos-foto";
import { SelosFoto } from "@/components/property/selos-foto";
import { deleteProperty } from "@/lib/data/actions";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { ReadyToLiveBadge } from "@/components/ui/badge";
import { BrandImage } from "@/components/brand-image";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { useDemoMode, DemoBadge } from "@/lib/demo/demo-mode";
import { DEMO_PROPERTIES, DEMO_PROPERTY_STATS } from "@/lib/demo/seed";
import type { Property, PropertyStatus } from "@/lib/types";
import { avisoExcluirRascunho, rotuloExcluirRascunho } from "@/lib/anuncio/excluir-rascunho";
import { faixaDocumentoAprovado, hrefParaMelhorar, hrefRetomarRascunho, type Prontidao } from "@/lib/anuncio/prontidao";
import { destinoPendencia } from "@/lib/anuncio/destino-pendencia";
import { cn, formatBRL } from "@/lib/utils";
import { PrecoComContexto } from "@/components/preco/preco-com-contexto";
import { mesesDoCartao, rotuloPreco } from "@/lib/cartao-preco";
import { estadiaDoCartaoDoDono, precoDoImovel, ROTULO_MENSAL, ROTULO_TOTAL_MES } from "@/lib/precos";
import { EstadoDoAnuncio } from "@/components/anuncio/estado-anuncio";
import { destinoDoCartao } from "@/lib/anuncio/destino-cartao";
import { ORDENS, POR_PAGINA, abasVisiveis, filtrarEOrdenar, juntarCopiasAoPai, paginar, type AbaEstado, type OrdemLista } from "@/lib/anuncio/lista-meus-imoveis";

/** E511: a barra da lista (abas, busca, ordem) aparece a partir desta quantidade de imóveis. */
const MIN_BARRA = 4;
import { semQuedaDeRede } from "@/lib/erro-de-rede";

/** Rótulo + tom do status do anúncio (rascunho/ativo/pausado/arquivado). */
const STATUS_META: Record<PropertyStatus, { label: string; tone: string }> = {
  draft: { label: "Rascunho", tone: "bg-amber-50 text-amber-700" },
  active: { label: "Ativo", tone: "bg-sage-100 text-forest" },
  paused: { label: "Pausado", tone: "bg-surface-2 text-muted" },
};

const hasPhoto = (s?: string) =>
  typeof s === "string" && (/^https?:\/\//.test(s) || s.startsWith("/"));

/**
 * Lista "Meus imóveis". Em modo demonstração (admin) a fonte vira o seed em
 * memória (8 imóveis fictícios); desligado, volta à lista real do servidor.
 */
export function MyPropertiesClient({
  properties: real,
  prontidao = {},
  pausas = {},
}: {
  properties: Property[];
  prontidao?: Record<string, Prontidao>;
  pausas?: Record<string, string | null>;
}) {
  const { on: demoOn } = useDemoMode();
  // Ids excluídos nesta sessão (rascunhos descartados) — some da lista na hora.
  const [removidos, setRemovidos] = useState<Set<string>>(new Set());
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);
  const properties = (demoOn ? DEMO_PROPERTIES : real).filter((p) => !removidos.has(p.id));

  const duplicados = idsRascunhosDuplicados(properties);
  // E383: de cada grupo de rascunhos repetidos, só o mais recente aparece; as cópias ficam atrás de "ver cópias".
  const grupos = gruposRascunhosDuplicados(properties);
  const copiasDe = new Map(grupos.map((g) => [g[0], g.slice(1)] as const));
  const copias = new Set(grupos.flatMap((g) => g.slice(1)));
  const [copiasAbertas, setCopiasAbertas] = useState<Set<string>>(new Set());
  const grupoAberto = (id: string) => grupos.some((g) => g.includes(id) && copiasAbertas.has(g[0]));
  const visiveis = properties.filter((p) => !copias.has(p.id) || grupoAberto(p.id));
  // E511: abas de estado, busca, ordem e "Mostrar mais" (antes, 27+ cartões de uma vez). A barra aparece a partir de
  // MIN_BARRA imóveis; abaixo disso a lista é curta e a barra só ocuparia lugar.
  const [aba, setAba] = useState<AbaEstado>("todos");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<OrdemLista>("recentes");
  const [paginas, setPaginas] = useState(1);
  const comBarra = visiveis.length >= MIN_BARRA;
  // E514: as cópias abertas ficam logo depois do cartão-pai (antes, iam para o fim da lista).
  const filtrada = juntarCopiasAoPai(comBarra ? filtrarEOrdenar(visiveis, { aba, busca, ordem }) : visiveis, copiasDe);
  const pagina = paginar(filtrada, paginas);
  const abas = abasVisiveis(visiveis);

  async function excluirRascunho(id: string) {
    setErroExcluir(null);
    setExcluindo(id);
    const res = await semQuedaDeRede(deleteProperty(id));
    setExcluindo(null);
    if (res.ok) setRemovidos((s) => new Set(s).add(id));
    else setErroExcluir(res.error ?? "Não foi possível excluir agora.");
  }

  return (
    <>
      <PageTitle
        title="Meus imóveis"
        subtitle="Gerencie seus anúncios e o status de publicação."
        action={
          <div className="flex items-center gap-2">
            {demoOn && <DemoBadge />}
            <ButtonLink href="/dashboard/imoveis/novo" variant="gold">
              <Plus className="h-4 w-4" /> Novo anúncio
            </ButtonLink>
          </div>
        }
      />
      {erroExcluir && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="imoveis-erro">
          {erroExcluir}
        </p>
      )}

      {properties.length === 0 ? (
        <EmptyState
          title="Você ainda não tem imóveis"
          text="Comece pelas fotos do seu imóvel: o resto do cadastro vem depois."
          action={
            <ButtonLink href="/dashboard/imoveis/novo" variant="secondary">
              Cadastrar imóvel
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid gap-4">
          {comBarra && (
            <div className="grid gap-3" data-testid="imoveis-barra">
              <div role="group" aria-label="Estado do anúncio" className="flex gap-2 overflow-x-auto" data-testid="imoveis-abas">
                {abas.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={aba === a.id}
                    onClick={() => {
                      setAba(a.id);
                      setPaginas(1);
                    }}
                    className={cn(
                      "inline-flex h-11 shrink-0 items-center gap-1 rounded-lg border px-3 text-sm font-semibold",
                      aba === a.id ? "border-forest bg-sage-100 text-forest" : "border-line bg-white text-ink",
                    )}
                    data-testid={`imoveis-aba-${a.id}`}
                  >
                    {a.rotulo} <span className="tabular-nums text-muted">({a.n})</span>
                  </button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem]">
                <label className="block">
                  <span className="sr-only">Buscar por nome, bairro ou cidade</span>
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => {
                      setBusca(e.target.value);
                      setPaginas(1);
                    }}
                    placeholder="Buscar por nome, bairro ou cidade"
                    className="h-11 w-full rounded-lg border border-line bg-white px-3 text-base text-ink"
                    data-testid="imoveis-busca"
                  />
                </label>
                <label className="block">
                  <span className="sr-only">Ordenar</span>
                  <select
                    value={ordem}
                    onChange={(e) => {
                      setOrdem(e.target.value as OrdemLista);
                      setPaginas(1);
                    }}
                    className="h-11 w-full rounded-lg border border-line bg-white px-3 text-base text-ink"
                    data-testid="imoveis-ordem"
                  >
                    {ORDENS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="text-sm text-muted" role="status" data-testid="imoveis-contagem">
                {filtrada.length === 1 ? "1 imóvel" : `${filtrada.length} imóveis`}
              </p>
            </div>
          )}
          {comBarra && filtrada.length === 0 && (
            <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink" data-testid="imoveis-sem-resultado">
              Nenhum imóvel com esse filtro. Troque a aba ou apague a busca.
            </p>
          )}
          {pagina.visiveis.map((p) => {
            const demoItem = demoOn;
            const stats = demoItem ? DEMO_PROPERTY_STATS[p.id] : undefined;
            const comp = prontidao[p.id];
            // E510: foto e título levam ao mesmo destino dos botões do cartão (ativo → página; rascunho → onde parou;
            // pausado → editor). Na demonstração, o título segue como texto (não há edição de verdade).
            const destino = destinoDoCartao({ id: p.id, status: p.status, retomar: hrefRetomarRascunho(prontidao[p.id], p.id) });
            return (
              <div
                key={p.id}
                className="flex flex-col gap-4 rounded-xl border border-sage-200 bg-white p-4 sm:flex-row"
                data-testid="meu-anuncio"
                data-imovel={p.id}
              >
                {/* E510: a foto é clicável em todo estado (o mesmo destino do título; fora da ordem de tabulação, o título já é o
                    link). `contents`: o link não cria caixa — a foto segue 4:3 e sem esticar com o cartão (E311, #1724). */}
                {/* E416 (05/11): os selos do anúncio sobre a foto, a mesma fileira da vitrine (sem coração aqui). */}
                <div className="relative w-full shrink-0 sm:w-48 sm:self-start" data-testid="meu-anuncio-foto">
                  <Link href={destino} tabIndex={-1} aria-hidden className="contents" data-testid="cartao-foto-link">
                    {hasPhoto(p.photos[0]) ? (
                      <BrandImage
                        src={p.photos[0]}
                        alt={p.title}
                        sizes="200px"
                        className="aspect-[4/3] w-full shrink-0 sm:w-48 sm:self-start"
                      />
                    ) : (
                      // E383: sem foto, só o ícone — nunca o "nome" da foto de teste nem um texto de placeholder por cartão.
                      <PhotoPlaceholder className="aspect-[4/3] w-full shrink-0 rounded-xl sm:w-48 sm:self-start" />
                    )}
                  </Link>
                  <SelosFoto
                    semCoracao
                    selos={selosDaFoto({ precoJusto: !!p.precoJusto, pets: !!p.petsAllowed, nivel: p.nivel, nivelVistoriado: p.nivelVistoriado, negocia: !!p.negociacao?.aceita })}
                  />
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* 64-B: o selo vira o menu de pausa (demonstração: só o selo). */}
                    {demoItem ? (
                      <span className={cn("rounded-full px-3 py-1 text-xs font-medium", STATUS_META[p.status].tone)}>{STATUS_META[p.status].label}</span>
                    ) : (
                      <EstadoDoAnuncio id={p.id} status={p.status} motivo={pausas[p.id] ?? null} />
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full border border-sage-200 px-3 py-1 text-xs font-medium text-ink">
                      {p.ownershipType !== "own" ? (
                        <>
                          <Handshake className="h-3.5 w-3.5 text-sage" /> {p.ownershipType === "managed" ? "Administrado" : "Operado"}
                        </>
                      ) : (
                        <>
                          <Home className="h-3.5 w-3.5 text-forest" /> Próprio
                        </>
                      )}
                    </span>
                    {p.readyToLiveBadge && <ReadyToLiveBadge />}
                    {/* E416 (05/11): o nível foi para os selos da foto (acima), junto dos outros. */}
                    {demoItem && <DemoBadge />}
                    {/* E383: o mais recente do grupo diz quantas cópias há e abre/fecha as cópias; cada cópia aberta se
                        marca para o dono decidir excluir. */}
                    {(copiasDe.get(p.id)?.length ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setCopiasAbertas((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
                        aria-expanded={copiasAbertas.has(p.id)}
                        className="inline-flex min-h-8 items-center rounded-full border border-amber-200 bg-white px-3 text-xs font-medium text-amber-800"
                        data-testid="rascunho-copias"
                      >
                        {copiasDe.get(p.id)!.length === 1 ? "1 cópia deste rascunho" : `${copiasDe.get(p.id)!.length} cópias deste rascunho`} · {copiasAbertas.has(p.id) ? "ocultar" : "ver"}
                      </button>
                    )}
                    {copias.has(p.id) && duplicados.has(p.id) && (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700" data-testid="rascunho-duplicado">
                        Rascunho duplicado — excluir?
                      </span>
                    )}
                  </div>
                  {/* E510: o título é link em todo estado. Só o anúncio no ar tem página pública (rascunho e pausado davam 404 —
                      t249 D-V7): nos outros ele leva à edição, como "Continuar editando" / "Editar". */}
                  {demoItem ? (
                    <span className="mt-2 font-title text-lg font-semibold text-ink">{p.title}</span>
                  ) : (
                    <Link href={destino} className="mt-2 font-title text-lg font-semibold text-ink hover:text-forest" data-testid="cartao-titulo-link">
                      {p.title}
                    </Link>
                  )}
                  <div className="mt-1 flex gap-4 text-sm text-muted">
                    <span className="inline-flex items-center gap-1">
                      <BedDouble className="h-4 w-4" /> {p.bedrooms}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Bath className="h-4 w-4" /> {p.bathrooms}
                    </span>
                    {stats && (
                      <span className="text-xs">
                        {stats.leads} interessado(s) · {stats.views} visualizações
                      </span>
                    )}
                  </div>
                  {/* Prontidão (fonte única: lib/anuncio/prontidao). "Falta" só tem
                      obrigatórios; selo/vídeo aparecem à parte, como melhoria. */}
                  {!demoItem && comp && (() => {
                    const faixa = faixaDocumentoAprovado(comp, p.status);
                    return faixa ? (
                      <p className="mt-3 rounded-lg bg-sage-100 px-3 py-2 text-xs font-medium text-forest" role="status" data-testid="faixa-documento-aprovado">
                        {faixa.titulo}
                        {faixa.faltam.length > 0 && `: ${faixa.faltam.join(" · ")}`}
                      </p>
                    ) : null;
                  })()}
                  {!demoItem && comp && !imovelPublicado(p) && (
                    <div className="mt-3" data-testid="prontidao">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink">
                          {comp.podePublicar ? "100% · Pronto para publicar" : `Anúncio ${comp.pct}% completo`}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${comp.pct}%` }} />
                      </div>
                      {/* P0 (30/10): cada pendência é um atalho para o PASSO dela no assistente (rascunho) — nunca o editor. */}
                      {comp.faltam.length > 0 && (
                        <p className="mt-1 text-[11px] text-amber-800" data-testid="falta-publicar">
                          Falta para publicar:{" "}
                          {comp.obrigatorios
                            .filter((o) => !o.ok)
                            .map((o, i) => (
                              <span key={o.key}>
                                {i > 0 && " · "}
                                <Link href={destinoPendencia(p, o.etapa)} className="font-medium underline" data-testid={`pendencia-${o.key}`}>
                                  {o.detalhe ? `${o.label} (${o.detalhe})` : o.label}
                                </Link>
                              </span>
                            ))}
                        </p>
                      )}
                      {comp.melhorar.length > 0 && (
                        <p className="mt-1 text-[11px] text-muted">
                          Para melhorar (opcional):{" "}
                          {comp.opcionais
                            .filter((o) => !o.ok)
                            .map((o, i) => {
                              // 65-B: o vídeo leva ao campo (rascunho: bloco do assistente; existente: seção Vídeo).
                              const href = hrefParaMelhorar(o.key, p.id, p.status === "draft");
                              return (
                                <span key={o.key}>
                                  {i > 0 && " · "}
                                  {href ? (
                                    <Link href={href} className="font-medium text-forest underline" data-testid={`melhorar-${o.key}`}>
                                      {o.label}
                                    </Link>
                                  ) : (
                                    o.label
                                  )}
                                </span>
                              );
                            })}
                        </p>
                      )}
                    </div>
                  )}
                  {/* Conformidade (cartões uniformes, 31/10): a linha da estadia mínima, mais longa, empurrava os botões para
                      baixo só nesse cartão. O preço ocupa o espaço que sobra e quebra a linha; os botões ficam no mesmo
                      lugar em todos os cartões (e a foto não estica com a altura do cartão). */}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3" data-testid="anuncio-rodape">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="text-xs text-muted" data-testid="anuncio-preco-rotulo">
                        {ROTULO_TOTAL_MES} · {ROTULO_MENSAL} {formatBRL(precoDoImovel(p).mensal)}
                      </p>
                      <PrecoComContexto rotulo={rotuloDoCartaoDoDono(p)} destaque="lg" />
                      {/* E399-C pacote 5: só o dono vê — por que o anúncio está sem o selo "Preço justo". */}
                      {p.avisoPrecoJusto && (
                        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-ink" data-testid="anuncio-preco-justo-aviso">
                          Sem o selo &quot;Preço justo&quot;: 30 noites no Airbnb saem por {formatBRL(p.avisoPrecoJusto.valorAirbnb)}. Para ganhar o selo, o
                          total por mês precisa ficar até {formatBRL(p.avisoPrecoJusto.ate)}.
                        </p>
                      )}
                    </div>
                    {/* Itens fictícios não têm página/edição real — sem links. */}
                    {!demoItem && (
                      <div className="flex flex-wrap gap-2">
                        {/* Rascunho não tem página pública ainda — só "Continuar
                            editando" (item 2 do QA: rascunho recuperável). */}
                        {p.status === "active" && (
                          <ButtonLink href={`/imoveis/${p.id}`} variant="outline" size="sm">
                            Ver
                          </ButtonLink>
                        )}
                        <ButtonLink
                          href={
                            p.status === "draft"
                              ? // E507 — o mesmo destino de retomada do Início (o 1º passo que falta), não o passo guardado.
                                hrefRetomarRascunho(prontidao[p.id], p.id)
                              : `/dashboard/imoveis/${p.id}/editar`
                          }
                          variant={p.status === "draft" ? "secondary" : "ghost"}
                          size="sm"
                        >
                          {p.status === "draft" ? "Continuar editando" : "Editar"}
                        </ButtonLink>
                        {/* Cartões compartilháveis (T2): o cartão do anúncio publicado, com QR para o WhatsApp. */}
                        {p.status === "active" && (
                          <ButtonLink href={`/dashboard/imoveis/${p.id}/cartao`} variant="outline" size="sm" data-testid="cartao-anuncio-link">
                            Cartão para compartilhar
                          </ButtonLink>
                        )}
                        {/* Prompt 54: desempenho do anúncio (visualizações, favoritos, candidaturas, com fórmula). */}
                        {p.status !== "draft" && (
                          <ButtonLink href={`/dashboard/imoveis/${p.id}/desempenho`} variant="outline" size="sm" data-testid="desempenho-link">
                            Desempenho
                          </ButtonLink>
                        )}
                        {/* Parceiros do imóvel (Prompt 38): limpeza, manutenção, lavanderia e fotografia fixas. */}
                        {p.status !== "draft" && (
                          <ButtonLink href={`/dashboard/imoveis/${p.id}/parceiros`} variant="outline" size="sm" data-testid="parceiros-imovel-link">
                            Parceiros
                          </ButtonLink>
                        )}
                        {/* Qualificação é POR IMÓVEL: cada rascunho qualifica o seu. E196: "Qualificação" abre as MESMAS 5 telas
                            do assistente (no rascunho) e é o único caminho — os requisitos e o documento ficam no "Antes de
                            publicar" da Revisão (Passo 10); a antiga página longa (/qualificar) foi absorvida. */}
                        {p.status === "draft" && (
                          <ButtonLink href={`/dashboard/imoveis/novo?draft=${p.id}&qualificacao=1`} variant="outline" size="sm" data-testid="rascunho-qualificacao">
                            Qualificação
                          </ButtonLink>
                        )}
                        {/* Excluir rascunho (item 1 do reteste — limpa órfãos). */}
                        {p.status === "draft" && (
                          <ConfirmarNaPagina
                            // E515: a confirmação nomeia o rascunho (título e bairro), não "este rascunho".
                            aviso={avisoExcluirRascunho(p.title, p.neighborhood)}
                            confirmar="Excluir"
                            onConfirmar={() => excluirRascunho(p.id)}
                            disabled={excluindo === p.id}
                            ariaLabel={rotuloExcluirRascunho(p.title, p.neighborhood)}
                            botaoClassName="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                            testid="excluir-rascunho"
                          >
                            <Trash2 className="h-4 w-4" />
                          </ConfirmarNaPagina>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {/* E511: "Mostrar mais" soma outra página (12 cartões) — nunca 27+ cartões de uma vez. */}
          {pagina.restantes > 0 && (
            <Button type="button" variant="secondary" onClick={() => setPaginas((n) => n + 1)} className="justify-self-center" data-testid="imoveis-mostrar-mais">
              Mostrar mais ({Math.min(pagina.restantes, POR_PAGINA)} de {pagina.restantes})
            </Button>
          )}
        </div>
      )}
    </>
  );
}

/**
 * E251 (d): o anúncio ainda não tem contrato — no cartão de Meus anúncios, o total do período é a "Estadia mínima
 * (N meses): R$ X". "Total do contrato" só onde há contrato. E254-A: o total e a conta aberta vêm da mesma função da
 * prévia do Passo 10 (com a limpeza de saída discriminada); com mínimo de 1 mês, sem a linha.
 */
function rotuloDoCartaoDoDono(p: Property) {
  const r = rotuloPreco({ mensal: precoDoImovel(p).totalPorMes, meses: mesesDoCartao(undefined, p.minPeriodDays), disponivelEm: p.availableFrom });
  return { ...r, estadia: estadiaDoCartaoDoDono(p, r.meses) };
}

