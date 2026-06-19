"use client";

import { useState } from "react";
import { Link2, Lock, Unlock, Phone, Mail, Users, X, Check, Send } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { OwnerDecisionNotice } from "@/components/legal-notice";
import type { Lead, Light } from "@/lib/data/leads";
import { cn } from "@/lib/utils";

/** Motivos de recusa pré-definidos (quick win #3). */
const REJECT_REASONS = [
  "Período não combina",
  "Imóvel já alugado",
  "Perfil não atende",
  "Aguardando outro interessado",
];

const LIGHT: Record<Light, { tone: string; label: string }> = {
  green: { tone: "bg-emerald-100 text-emerald-700", label: "🟢 Perfil limpo" },
  yellow: { tone: "bg-amber-100 text-amber-700", label: "🟡 Atenção" },
  red: { tone: "bg-red-100 text-red-700", label: "🔴 Alto risco" },
};

type LeadStatus = "open" | "approved" | "rejecting" | "rejected";

export function LeadsClient({ leads }: { leads: Lead[] }) {
  const [status, setStatus] = useState<Record<string, LeadStatus>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  function set(id: string, s: LeadStatus) {
    setStatus((prev) => ({ ...prev, [id]: s }));
  }

  return (
    <>
      <PageTitle
        title="Leads"
        subtitle="Inquilinos interessados. Você vê o necessário para decidir; o contato direto é liberado após o aceite."
      />

      {leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum lead ainda"
          text="Quando um inquilino enviar uma consulta sobre seus imóveis, ele aparece aqui."
        />
      ) : (
        <div className="grid gap-4">
          {leads.map((l) => {
            const st = status[l.id] ?? "open";
            const open = st === "approved";
            return (
              <Panel key={l.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-title text-lg font-bold text-ink">{l.name}</h3>
                      {l.verified && (
                        <span className="rounded-full bg-champagne px-2 py-0.5 text-xs font-semibold text-night">
                          Inquilino Verificado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted">
                      {l.category} · interesse em {l.property}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", LIGHT[l.light].tone)}>
                        {LIGHT[l.light].label}
                      </span>
                      {l.riskCategories.map((c) => (
                        <span key={c} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                          {c}
                        </span>
                      ))}
                      {l.linkedin && (
                        <a
                          href={l.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-[#0a66c2]/10 px-2.5 py-1 text-xs font-medium text-[#0a66c2]"
                        >
                          <Link2 className="h-3.5 w-3.5" /> LinkedIn
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    {open ? (
                      <div className="rounded-xl bg-sage-100 p-3 text-sm">
                        <p className="flex items-center gap-1.5 text-forest">
                          <Phone className="h-4 w-4" /> {l.phone}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-forest">
                          <Mail className="h-4 w-4" /> {l.email}
                        </p>
                      </div>
                    ) : st === "rejected" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600">
                        <X className="h-4 w-4" /> Recusado
                      </span>
                    ) : st !== "rejecting" ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => set(l.id, "rejecting")}
                          className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" /> Recusar
                        </button>
                        <button
                          onClick={() => set(l.id, "approved")}
                          className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-700"
                        >
                          <Unlock className="h-4 w-4" /> Pré-aprovar e liberar contato
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Formulário de recusa com motivo (Fluxo 7 + motivos rápidos) */}
                {st === "rejecting" && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-700">
                      Recusar {l.name} — escolha um motivo (será enviado ao interessado)
                    </p>
                    {/* Motivos pré-definidos em um clique (quick win #3) */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {REJECT_REASONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setReasons((p) => ({ ...p, [l.id]: r }))}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                            reasons[l.id] === r
                              ? "border-red-400 bg-red-100 text-red-700"
                              : "border-red-200 bg-white text-red-600 hover:bg-red-100"
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reasons[l.id] ?? ""}
                      onChange={(e) => setReasons((p) => ({ ...p, [l.id]: e.target.value }))}
                      rows={2}
                      placeholder="Ou escreva um motivo personalizado…"
                      className="mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        onClick={() => set(l.id, "open")}
                        className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted hover:text-ink"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => set(l.id, "rejected")}
                        disabled={!(reasons[l.id] ?? "").trim()}
                        className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" /> Enviar recusa
                      </button>
                    </div>
                  </div>
                )}

                {st === "rejected" && reasons[l.id] && (
                  <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Motivo enviado ao interessado: “{reasons[l.id]}”
                  </p>
                )}

                {st === "open" && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                    <Lock className="h-3.5 w-3.5" />
                    Telefone, e-mail e endereço exato ficam ocultos até o aceite (LGPD).
                  </p>
                )}

                {open && (
                  <div className="mt-4 flex justify-end">
                    <ButtonLink href="/dashboard/fechamento" variant="accent" size="sm">
                      Iniciar fechamento
                    </ButtonLink>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      <OwnerDecisionNotice className="mt-4" />
    </>
  );
}
