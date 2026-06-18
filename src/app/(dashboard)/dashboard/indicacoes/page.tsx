"use client";

import { useMemo, useState } from "react";
import { Gift, Copy, Check, Users, BadgeDollarSign } from "lucide-react";
import { PageTitle, Panel, StatCard } from "@/components/dashboard/primitives";
import { useAuthStore } from "@/lib/store";
import { SITE_URL } from "@/lib/site";

/** Gera um código de indicação a partir do nome/id do usuário. */
function referralCode(name: string, id: string) {
  const first = (name.split(" ")[0] || "VIVA").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
  const suffix = id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "000";
  return `VIVA-${first}${suffix}`;
}

export default function ReferralsPage() {
  const user = useAuthStore((s) => s.user);
  const [copied, setCopied] = useState(false);

  const code = useMemo(
    () => referralCode(user?.name ?? "Viva", user?.id ?? "000"),
    [user]
  );
  const link = `${SITE_URL}/auth?ref=${code}`;

  function copy() {
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `Conheça o Viva Nomads — locação mobiliada mensal. Cadastre-se pelo meu link: ${link}`
  )}`;

  return (
    <>
      <PageTitle
        title="Programa de indicação"
        subtitle="Indique e ganhe créditos quando seus indicados fecharem a primeira reserva."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Indicados" value="0" icon={Users} />
        <StatCard label="Converteram" value="0" icon={Check} />
        <StatCard label="Créditos" value="R$ 0" icon={BadgeDollarSign} />
      </div>

      <Panel className="bg-forest text-white">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-champagne" />
          <h2 className="font-title text-lg font-bold">Seu link de indicação</h2>
        </div>
        <p className="mt-1 text-sm text-white/70">
          Seu código: <strong className="text-green-300">{code}</strong>
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={link}
            className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm text-white outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={copy}
              className="inline-flex items-center gap-2 rounded-xl bg-champagne px-4 py-2.5 text-sm font-semibold text-forest"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-forest"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </Panel>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Panel title="Indicou um proprietário?">
          <p className="text-sm text-muted">
            Você ganha <strong className="text-forest">crédito em comissão</strong> (ou serviço
            grátis: verificação/contrato) quando o proprietário indicado fecha a primeira reserva.
          </p>
        </Panel>
        <Panel title="Indicou um inquilino?">
          <p className="text-sm text-muted">
            Você ganha <strong className="text-forest">crédito em serviços</strong> quando o
            inquilino indicado fecha a primeira locação. O indicado ganha um benefício de
            boas-vindas (1ª verificação de identidade grátis).
          </p>
        </Panel>
      </div>

      <p className="mt-4 text-xs text-muted">
        A recompensa é liberada apenas após o evento qualificador real (primeira reserva ou
        locação), evitando fraude.
      </p>
    </>
  );
}
