"use client";

import { useState } from "react";
import { ShieldCheck, BadgeCheck, Fingerprint, ScanFace, FileCheck2, Zap, Loader2 } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { OwnerDecisionNotice } from "@/components/legal-notice";
import { TRAFFIC_LIGHT_META, type CafResult } from "@/lib/closing";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Perfil de Inquilino Verificado (Atualização 4.1/4.2).
 * O inquilino verifica uma vez (CAF) e reusa o laudo em várias candidaturas.
 */
export default function VerificationPage() {
  const user = useAuthStore((s) => s.user);
  const [result, setResult] = useState<CafResult | null>(null);
  const [validUntil, setValidUntil] = useState("");
  const [loading, setLoading] = useState(false);

  async function verify() {
    setLoading(true);
    try {
      const res = await fetch("/api/caf/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: user?.name ?? "Inquilino" }),
      });
      setResult((await res.json()) as CafResult);
      // Validade do laudo reutilizável: 90 dias.
      setValidUntil(new Date(Date.now() + 90 * 86400000).toLocaleDateString("pt-BR"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="Inquilino Verificado"
        subtitle="Verifique uma vez e candidate-se com um clique em qualquer imóvel."
      />

      {!result ? (
        <Panel className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sage-100">
            <ShieldCheck className="h-8 w-8 text-forest" />
          </div>
          <h2 className="mt-4 font-title text-xl font-bold text-ink">
            Crie seu passaporte de locação
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            A verificação CAF confirma sua identidade, documento e prova de vida. Depois, o selo{" "}
            <strong>Inquilino Verificado</strong> acompanha você em todas as candidaturas — sem
            refazer a cada imóvel.
          </p>
          <Button variant="gold" className="mt-6" onClick={verify} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Verificando..." : "Iniciar verificação"}
          </Button>
        </Panel>
      ) : (
        <div className="space-y-4">
          <Panel>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-champagne text-forest">
                <BadgeCheck className="h-7 w-7" />
              </span>
              <div>
                <h2 className="font-title text-lg font-bold text-ink">
                  Inquilino Verificado {TRAFFIC_LIGHT_META[result.light].emoji}
                </h2>
                <p className="text-sm text-muted">
                  Laudo reutilizável · válido até {validUntil}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Item icon={Fingerprint} label="Identidade" ok={result.identity} />
              <Item icon={ScanFace} label="Prova de vida" ok={result.liveness} />
              <Item icon={FileCheck2} label="Documento" ok={result.document} />
            </div>
          </Panel>

          <Panel className="flex items-start gap-3 bg-forest text-white">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-champagne" />
            <div>
              <h3 className="font-title font-bold">Candidatura com um clique ativada</h3>
              <p className="text-sm text-white/80">
                Agora, ao encontrar um imóvel, basta clicar em <strong>Candidatar-se</strong>:
                enviamos seu laudo (semáforo) e uma mensagem ao proprietário automaticamente.
              </p>
            </div>
          </Panel>

          <OwnerDecisionNotice />
        </div>
      )}
    </div>
  );
}

function Item({
  icon: Icon,
  label,
  ok,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  ok: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        ok ? "border-sage bg-sage-100 text-forest" : "border-sage-200 text-muted"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </div>
  );
}
