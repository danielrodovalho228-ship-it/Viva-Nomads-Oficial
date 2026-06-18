"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  ArrowLeft,
  ArrowRight,
  FileText,
  Send,
  CalendarClock,
  Hash,
  CheckCircle2,
} from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { PropertyMiniCard } from "@/components/property-mini-card";
import { DocumentShare } from "@/components/document-share";
import { PlatformLegalNotice } from "@/components/legal-notice";
import { SAMPLE_PROPERTIES } from "@/lib/properties";
import {
  SAMPLE_DOCUMENTS,
  DOC_STATUS_META,
  buildDefaultLineItems,
  documentTotal,
  nextOrcamentoNumber,
  type DocumentRecord,
  type LineItem,
} from "@/lib/documents";
import { formatBRL, cn } from "@/lib/utils";

type View = "list" | "new" | "doc";

export default function OrcamentosPage() {
  const [view, setView] = useState<View>("list");
  const [active, setActive] = useState<DocumentRecord | null>(null);

  function openDoc(d: DocumentRecord) {
    setActive(d);
    setView("doc");
  }

  if (view === "new") {
    return <NewBudget onCancel={() => setView("list")} onCreated={openDoc} />;
  }
  if (view === "doc" && active) {
    return <DocView doc={active} onBack={() => setView("list")} />;
  }

  const orcamentos = SAMPLE_DOCUMENTS;

  return (
    <>
      <PageTitle
        title="Orçamentos"
        subtitle="Envie um orçamento numerado e acompanhe até virar contrato assinado."
        action={
          <Button variant="gold" onClick={() => setView("new")}>
            <Plus className="h-4 w-4" /> Novo orçamento
          </Button>
        }
      />

      {orcamentos.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum orçamento ainda"
          text="Crie um orçamento para um interessado — é mais leve de oferecer que um contrato."
          action={
            <Button variant="gold" onClick={() => setView("new")}>
              <Plus className="h-4 w-4" /> Novo orçamento
            </Button>
          }
        />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sage-200 text-left text-muted">
                <th className="pb-2 font-medium">Número</th>
                <th className="pb-2 font-medium">Imóvel</th>
                <th className="pb-2 font-medium">Interessado</th>
                <th className="pb-2 pr-6 text-right font-medium">Valor</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {orcamentos.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => openDoc(d)}
                  className="cursor-pointer border-b border-sage-200/60 last:border-0 hover:bg-surface-2"
                >
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-ink">
                      <Hash className="h-3.5 w-3.5 text-muted" />
                      {d.docNumber}
                      {d.version > 1 && (
                        <span className="rounded bg-surface-2 px-1 text-[10px] text-muted">
                          v{d.version}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="max-w-[180px] py-3">
                    <span className="line-clamp-1 text-ink">{d.propertyTitle}</span>
                  </td>
                  <td className="py-3 text-ink">{d.tenantName}</td>
                  <td className="py-3 pr-6 text-right font-medium text-ink">
                    {formatBRL(d.totalValue)}
                  </td>
                  <td className="py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="py-3 text-muted">{formatDate(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <PlatformLegalNotice className="mt-4" />
    </>
  );
}

function StatusBadge({ status }: { status: DocumentRecord["status"] }) {
  const meta = DOC_STATUS_META[status];
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", meta.tone)}>
      {meta.label}
    </span>
  );
}

/** Monta o registro do novo orçamento (fora do componente — usa Date no clique). */
function buildNewDoc(input: {
  property: { id: string; title: string };
  tenantName: string;
  tenantContact: string;
  validDays: number;
  items: LineItem[];
  total: number;
}): DocumentRecord {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const validUntil = new Date(now.getTime() + input.validDays * 86400000)
    .toISOString()
    .slice(0, 10);
  return {
    id: `doc-${now.getTime()}`,
    docNumber: nextOrcamentoNumber(),
    docType: "orcamento",
    version: 1,
    propertyId: input.property.id,
    propertyTitle: input.property.title,
    ownerId: "demo-owner",
    tenantName: input.tenantName,
    tenantContact: input.tenantContact,
    status: "enviado",
    totalValue: input.total,
    validUntil,
    lineItems: input.items,
    createdAt: today,
    sentAt: today,
  };
}

// ── Construtor de novo orçamento (Atualizações 14 + 16) ──

function NewBudget({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (d: DocumentRecord) => void;
}) {
  const [step, setStep] = useState(0);
  const [propertyId, setPropertyId] = useState(SAMPLE_PROPERTIES[0].id);
  const [tenantName, setTenantName] = useState("");
  const [tenantContact, setTenantContact] = useState("");
  const [validDays, setValidDays] = useState(7);
  const property = SAMPLE_PROPERTIES.find((p) => p.id === propertyId)!;
  const [items, setItems] = useState<LineItem[]>(() => buildDefaultLineItems(property));

  // Reconstrói os itens sugeridos ao trocar de imóvel.
  function selectProperty(id: string) {
    setPropertyId(id);
    const p = SAMPLE_PROPERTIES.find((x) => x.id === id)!;
    setItems(buildDefaultLineItems(p));
  }

  function setAmount(key: string, amount: number) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, amount, suggested: false } : i))
    );
  }
  function togglePayer(key: string) {
    setItems((prev) =>
      prev.map((i) =>
        i.key === key ? { ...i, payer: i.payer === "tenant" ? "owner" : "tenant" } : i
      )
    );
  }

  const total = documentTotal(items);

  function create() {
    onCreated(
      buildNewDoc({
        property,
        tenantName: tenantName || "Interessado",
        tenantContact,
        validDays,
        items,
        total,
      })
    );
  }

  const canAdvance = step === 0 || (step === 1 && tenantName.trim().length > 0) || step === 2;

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Novo orçamento" subtitle="Imóvel → interessado → valores" />

      {/* Card do imóvel no topo (Atualização 16) */}
      <div className="mb-5">
        <PropertyMiniCard property={property} />
      </div>

      <div className="mb-5 flex items-center gap-2 text-sm">
        {["Imóvel", "Interessado", "Valores"].map((s, i) => (
          <span
            key={s}
            className={cn(
              "rounded-full px-3 py-1",
              i === step ? "bg-forest text-white" : i < step ? "bg-sage-100 text-forest" : "bg-surface-2 text-muted"
            )}
          >
            {i + 1}. {s}
          </span>
        ))}
      </div>

      <Panel>
        {step === 0 && (
          <div className="space-y-3">
            <h2 className="font-title text-lg font-bold text-ink">Qual imóvel?</h2>
            <div className="space-y-2">
              {SAMPLE_PROPERTIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProperty(p.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-colors",
                    propertyId === p.id ? "border-forest bg-sage-100" : "border-sage-200 hover:border-sage"
                  )}
                >
                  <span className="line-clamp-1 text-sm font-medium text-ink">{p.title}</span>
                  <span className="shrink-0 text-sm text-muted">{formatBRL(p.monthlyPrice)}/mês</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-title text-lg font-bold text-ink">Para quem é o orçamento?</h2>
            <Labeled label="Nome do interessado">
              <input
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="Ex.: Ana Carvalho"
                className="vn-input"
              />
            </Labeled>
            <Labeled label="Contato (e-mail ou telefone) — opcional">
              <input
                value={tenantContact}
                onChange={(e) => setTenantContact(e.target.value)}
                placeholder="ana@email.com ou (34) 99999-0000"
                className="vn-input"
              />
            </Labeled>
            <Labeled label="Validade do orçamento">
              <select
                value={validDays}
                onChange={(e) => setValidDays(Number(e.target.value))}
                className="vn-input"
              >
                <option value={7}>7 dias</option>
                <option value={14}>14 dias</option>
                <option value={30}>30 dias</option>
              </select>
            </Labeled>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-title text-lg font-bold text-ink">Valores</h2>
            <p className="text-sm text-muted">
              Os valores marcados como <em>sugeridos</em> vêm pré-preenchidos pelo nº de
              quartos e metragem. Edite à vontade — o total recalcula na hora.
            </p>
            <div className="space-y-2.5">
              {items.map((item) => (
                <div key={item.key} className="rounded-xl border border-sage-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {item.label}
                        {item.suggested && (
                          <span className="ml-2 rounded bg-champagne/20 px-1.5 py-0.5 text-[10px] font-medium text-forest">
                            sugerido
                          </span>
                        )}
                        {!item.recurring && (
                          <span className="ml-1 text-[10px] text-muted">(única)</span>
                        )}
                      </p>
                      {item.hint && <p className="text-xs text-muted">{item.hint}</p>}
                    </div>
                    <div className="relative shrink-0">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">
                        R$
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={item.amount || ""}
                        onChange={(e) => setAmount(item.key, Number(e.target.value))}
                        className="w-28 rounded-lg border border-sage-200 bg-white py-1.5 pl-8 pr-2 text-right text-sm outline-none focus:border-sage"
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-muted">Quem paga:</span>
                    <div className="flex rounded-full bg-surface-2 p-0.5 text-[11px]">
                      {(["tenant", "owner"] as const).map((party) => (
                        <button
                          key={party}
                          type="button"
                          onClick={() => item.payer !== party && togglePayer(item.key)}
                          className={cn(
                            "rounded-full px-2.5 py-0.5 font-medium transition-colors",
                            item.payer === party ? "bg-forest text-white" : "text-muted"
                          )}
                        >
                          {party === "owner" ? "Proprietário" : "Inquilino"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total transparente que o inquilino vê */}
            <div className="rounded-xl bg-blue-50 p-4 text-sm">
              <p className="font-medium text-blue-900">O inquilino paga no 1º pagamento</p>
              <div className="mt-2 flex items-center justify-between border-t border-blue-200 pt-2 font-bold text-blue-900">
                <span>Total</span>
                <span>{formatBRL(total)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? onCancel() : setStep((s) => s - 1))}
          >
            <ArrowLeft className="h-4 w-4" /> {step === 0 ? "Cancelar" : "Voltar"}
          </Button>
          {step < 2 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="gold" onClick={create}>
              <Send className="h-4 w-4" /> Gerar e enviar orçamento
            </Button>
          )}
        </div>
      </Panel>

      <style>{`.vn-input{width:100%;border-radius:0.75rem;border:1px solid var(--color-sage-200);background:#fff;padding:0.625rem 0.875rem;font-size:0.875rem;outline:none}.vn-input:focus{border-color:var(--color-sage)}`}</style>
    </div>
  );
}

// ── Documento gerado: preview formatado + compartilhamento (Atualização 17) ──

function DocView({ doc, onBack }: { doc: DocumentRecord; onBack: () => void }) {
  const property = SAMPLE_PROPERTIES.find((p) => p.id === doc.propertyId);
  const shareUrl = useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.origin}/dashboard/orcamentos?doc=${doc.docNumber}`
        : `https://vivanomads.com.br/doc/${doc.docNumber}`,
    [doc.docNumber]
  );
  const isOrcamento = doc.docType === "orcamento";
  const accepted = doc.status === "aceito";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <DocumentShare
          docNumber={doc.docNumber}
          shareUrl={shareUrl}
          summary={`${isOrcamento ? "Orçamento" : "Contrato"} para ${doc.tenantName} — ${doc.propertyTitle} · ${formatBRL(doc.totalValue)}`}
        />
      </div>

      {/* Documento formatado (área impressa) */}
      <div className="rounded-2xl border border-sage-200 bg-white p-6 print:border-0">
        <div className="flex items-start justify-between border-b border-sage-200 pb-4">
          <div>
            <p className="font-title text-xl font-extrabold text-forest">Viva Nomads</p>
            <p className="text-xs text-muted">Locação por temporada · 30 a 180 dias</p>
          </div>
          <div className="text-right">
            <p className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-ink">
              <Hash className="h-4 w-4 text-muted" />
              {doc.docNumber}
            </p>
            <p className="text-xs text-muted">
              Versão {doc.version} · {formatDate(doc.createdAt)}
            </p>
            <div className="mt-1 flex justify-end">
              <StatusBadge status={doc.status} />
            </div>
          </div>
        </div>

        <h1 className="mt-4 font-title text-lg font-bold text-ink">
          {isOrcamento ? "Orçamento de locação por temporada" : "Contrato de locação por temporada"}
        </h1>

        {property && (
          <div className="mt-3">
            <PropertyMiniCard property={property} />
          </div>
        )}

        <div className="mt-4 grid gap-1 text-sm">
          <Row label="Interessado" value={doc.tenantName} />
          {doc.tenantContact && <Row label="Contato" value={doc.tenantContact} />}
          {doc.validUntil && isOrcamento && (
            <Row label="Válido até" value={formatDate(doc.validUntil)} />
          )}
        </div>

        {/* Itens */}
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-sage-200 text-left text-muted">
              <th className="pb-1 font-medium">Item</th>
              <th className="pb-1 font-medium">Quem paga</th>
              <th className="pb-1 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {doc.lineItems.map((i) => (
              <tr key={i.key} className="border-b border-sage-200/60">
                <td className="py-2 text-ink">
                  {i.label}
                  {!i.recurring && <span className="ml-1 text-xs text-muted">(única)</span>}
                </td>
                <td className="py-2 text-muted">{i.payer === "owner" ? "Proprietário" : "Inquilino"}</td>
                <td className="py-2 text-right text-ink">
                  {formatBRL(i.amount)}
                  {i.recurring && <span className="text-xs text-muted">/mês</span>}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} className="pt-3 font-bold text-ink">
                Total do 1º pagamento (inquilino)
              </td>
              <td className="pt-3 text-right font-title text-lg font-extrabold text-forest">
                {formatBRL(doc.totalValue)}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-5 border-t border-sage-200 pt-3 text-[11px] leading-relaxed text-muted">
          A Viva Nomads conecta, verifica, documenta e registra — não é locadora, fiadora,
          garantidora nem executora. Este documento ({doc.docNumber}, v{doc.version}) é um
          instrumento entre as partes; a plataforma apenas o gera e registra. Locação por
          temporada nos termos do art. 48 da Lei 8.245/91.
        </p>
      </div>

      {/* Conversão orçamento → fechamento (Atualização 13.2) */}
      {isOrcamento && (
        <div className="mt-4 print:hidden">
          {accepted ? (
            <Link href="/dashboard/fechamento">
              <Button variant="gold" className="w-full">
                <CheckCircle2 className="h-4 w-4" /> Orçamento aceito — gerar fechamento
              </Button>
            </Link>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-sage-200 bg-surface-2 px-4 py-3 text-sm text-muted">
              <CalendarClock className="h-4 w-4" />
              Aguardando resposta do interessado. Quando aceito, vira fechamento sem retrabalho.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}
