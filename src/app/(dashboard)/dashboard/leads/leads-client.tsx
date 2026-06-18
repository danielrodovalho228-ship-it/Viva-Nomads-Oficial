"use client";

import { useState } from "react";
import { Link2, Lock, Unlock, Phone, Mail, Users } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { OwnerDecisionNotice } from "@/components/legal-notice";
import type { Lead, Light } from "@/lib/data/leads";
import { cn } from "@/lib/utils";

const LIGHT: Record<Light, { tone: string; label: string }> = {
  green: { tone: "bg-emerald-100 text-emerald-700", label: "🟢 Perfil limpo" },
  yellow: { tone: "bg-amber-100 text-amber-700", label: "🟡 Atenção" },
  red: { tone: "bg-red-100 text-red-700", label: "🔴 Alto risco" },
};

export function LeadsClient({ leads }: { leads: Lead[] }) {
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});

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
            const open = unlocked[l.id];
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
                    ) : (
                      <button
                        onClick={() => setUnlocked((s) => ({ ...s, [l.id]: true }))}
                        className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-700"
                      >
                        <Unlock className="h-4 w-4" /> Pré-aprovar e liberar contato
                      </button>
                    )}
                  </div>
                </div>

                {!open && (
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
