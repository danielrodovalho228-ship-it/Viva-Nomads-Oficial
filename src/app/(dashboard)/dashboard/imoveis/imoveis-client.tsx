"use client";

import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { imovelPublicado } from "@/lib/anuncio/publicados";
import { useState } from "react";
import Link from "next/link";
import { Plus, Bath, BedDouble, Home, Handshake, Trash2 } from "lucide-react";
import { deleteProperty } from "@/lib/data/actions";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { EmptyBuildingIllustration } from "@/components/illustrations";
import { ButtonLink } from "@/components/ui/button";
import { ReadyToLiveBadge } from "@/components/ui/badge";
import { BrandImage } from "@/components/brand-image";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { useDemoMode, DemoBadge } from "@/lib/demo/demo-mode";
import { DEMO_PROPERTIES, DEMO_PROPERTY_STATS } from "@/lib/demo/seed";
import type { Property, PropertyStatus } from "@/lib/types";
import { faixaDocumentoAprovado, type Prontidao } from "@/lib/anuncio/prontidao";
import { formatBRL, cn } from "@/lib/utils";

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
export function MyPropertiesClient({ properties: real, prontidao = {} }: { properties: Property[]; prontidao?: Record<string, Prontidao> }) {
  const { on: demoOn } = useDemoMode();
  // Ids excluídos nesta sessão (rascunhos descartados) — some da lista na hora.
  const [removidos, setRemovidos] = useState<Set<string>>(new Set());
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);
  const properties = (demoOn ? DEMO_PROPERTIES : real).filter((p) => !removidos.has(p.id));

  async function excluirRascunho(id: string) {
    setErroExcluir(null);
    setExcluindo(id);
    const res = await deleteProperty(id);
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
          illustration={<EmptyBuildingIllustration />}
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
          {properties.map((p) => {
            const demoItem = demoOn;
            const stats = demoItem ? DEMO_PROPERTY_STATS[p.id] : undefined;
            const comp = prontidao[p.id];
            return (
              <div
                key={p.id}
                className="flex flex-col gap-4 rounded-xl border border-sage-200 bg-white p-4 sm:flex-row"
              >
                {hasPhoto(p.photos[0]) ? (
                  <BrandImage
                    src={p.photos[0]}
                    alt={p.title}
                    sizes="200px"
                    className="aspect-[4/3] w-full shrink-0 sm:w-48"
                  />
                ) : (
                  <PhotoPlaceholder
                    label={p.photos[0]}
                    className="aspect-[4/3] w-full shrink-0 rounded-xl sm:w-48"
                  />
                )}
                <div className="flex flex-1 flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        STATUS_META[p.status].tone
                      )}
                    >
                      {STATUS_META[p.status].label}
                    </span>
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
                    {demoItem && <DemoBadge />}
                  </div>
                  {/* Só anúncio no ar tem página pública: nos outros o título é texto (rascunho e pausado davam 404 —
                      t249 D-V7) e a ação é "Continuar editando" ou "Editar". */}
                  {demoItem || p.status !== "active" ? (
                    <span className="mt-2 font-title text-lg font-semibold text-ink">{p.title}</span>
                  ) : (
                    <Link href={`/imoveis/${p.id}`} className="mt-2 font-title text-lg font-semibold text-ink hover:text-forest">
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
                      {comp.faltam.length > 0 && <p className="mt-1 text-[11px] text-amber-800">Falta para publicar: {comp.faltam.join(" · ")}</p>}
                      {comp.melhorar.length > 0 && <p className="mt-1 text-[11px] text-muted">Para melhorar (opcional): {comp.melhorar.join(" · ")}</p>}
                    </div>
                  )}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                    <span className="font-title text-xl font-semibold text-forest">
                      {formatBRL(p.monthlyPrice)}
                      <span className="text-sm font-normal text-muted">/mês</span>
                    </span>
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
                              ? `/dashboard/imoveis/novo?draft=${p.id}`
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
                        {/* Qualificação é POR IMÓVEL: cada rascunho qualifica o seu. */}
                        {p.status === "draft" && (
                          <ButtonLink href={`/qualificar?imovel=${p.id}`} variant="outline" size="sm">
                            Qualificação
                          </ButtonLink>
                        )}
                        {/* Excluir rascunho (item 1 do reteste — limpa órfãos). */}
                        {p.status === "draft" && (
                          <ConfirmarNaPagina
                            aviso="Excluir este rascunho? Esta ação não pode ser desfeita."
                            confirmar="Excluir"
                            onConfirmar={() => excluirRascunho(p.id)}
                            disabled={excluindo === p.id}
                            ariaLabel="Excluir rascunho"
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
        </div>
      )}
    </>
  );
}
