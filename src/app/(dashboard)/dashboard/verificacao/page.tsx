"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  ShieldAlert,
  BadgeCheck,
  Fingerprint,
  ScanFace,
  FileCheck2,
  Zap,
  Loader2,
  Info,
  Lock,
  BellRing,
  Check,
  Search,
  Megaphone,
} from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { OwnerDecisionNotice } from "@/components/legal-notice";
import { VerificationBadge } from "@/components/verification-badge";
import { TRAFFIC_LIGHT_META, type CafResult } from "@/lib/closing";
import { useAuthStore } from "@/lib/store";
import { useViewMode } from "@/lib/roles";
import { useDashDemo, DemoBadge } from "@/lib/demo/demo-mode";
import { cn } from "@/lib/utils";

/**
 * Estados futuros da verificação (preparados; a integração real entra depois):
 *   nao_verificado → em_andamento → verificado → expirado
 * Hoje: conta REAL fica sempre em `nao_verificado` (parceiro em estruturação);
 * o modo DEMONSTRAÇÃO (admin) simula o fluxo até `verificado` para vitrine.
 */
export type VerifStatus = "nao_verificado" | "em_andamento" | "verificado" | "expirado";

type VerifyCopy = {
  title: string;
  subtitle: string;
  heading: string;
  badge: string;
  button: string;
  ctaTitle: string;
  ctaBody: string;
  unlocks: readonly string[];
};

const VERIFY_COPY: Record<"tenant" | "owner", VerifyCopy> = {
  tenant: {
    title: "Verificação",
    subtitle: "Verifique uma vez e candidate-se com um clique em qualquer imóvel.",
    heading: "Crie seu passaporte de locação",
    badge: "Inquilino Verificado",
    button: "Verificar identidade como inquilino",
    ctaTitle: "Candidatura com um clique ativada",
    ctaBody:
      "Ao encontrar um imóvel, basta clicar em Candidatar-se: enviamos seu resultado (em 3 níveis — verde, amarelo ou vermelho) e uma mensagem ao proprietário automaticamente.",
    unlocks: [
      "Candidatura com 1 clique em qualquer imóvel",
      "Seu resultado (verde/amarelo/vermelho) enviado ao proprietário automaticamente",
    ],
  },
  owner: {
    title: "Verificação",
    subtitle: "Verifique seu perfil para gerar mais confiança e converter mais interessados.",
    heading: "Construa a confiança do seu anúncio",
    badge: "Proprietário Verificado",
    button: "Verificar meu perfil de proprietário",
    ctaTitle: "Selo de confiança ativado",
    ctaBody:
      "Seu selo Proprietário Verificado passa a aparecer nos seus anúncios — mais confiança e melhor conversão dos interessados.",
    unlocks: [
      "Selo Proprietário Verificado nos seus anúncios",
      "Mais confiança e conversão dos interessados",
    ],
  },
}

export default function VerificationPage() {
  const demo = useDashDemo();
  const { mode } = useViewMode();
  // Intenção explícita (?como=inquilino|proprietario) tem prioridade sobre o
  // modo atual: um proprietário-admin que chega aqui por um CTA de CANDIDATURA
  // (ação de inquilino) precisa ver a cópia de inquilino, não a de proprietário.
  const params = useSearchParams();
  const como = params.get("como");
  const perfilCopy: "tenant" | "owner" =
    como === "inquilino" ? "tenant" : como === "proprietario" ? "owner" : mode;
  const C = VERIFY_COPY[perfilCopy];

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle title={C.title} subtitle={C.subtitle} />
      {demo ? <DemoFlow copy={C} mode={mode} /> : <RealNaoVerificado copy={C} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   CONTA REAL — integração via parceiro EM ESTRUTURAÇÃO.
   Nunca nasce verificada nem exibe selo sem verificação real concluída.
   ───────────────────────────────────────────────────────────────────────── */
function RealNaoVerificado({ copy }: { copy: VerifyCopy }) {
  const [avisar, setAvisar] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("vivanomads-verif-interesse")) setAvisar(true);
    } catch {
      /* ignore */
    }
  }, []);

  function registrarInteresse() {
    // Placeholder honesto: registra o interesse no navegador. Quando existir a
    // lista de espera no servidor, este clique passa a gravá-la também.
    try {
      localStorage.setItem("vivanomads-verif-interesse", "1");
    } catch {
      /* ignore */
    }
    setAvisar(true);
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted">
              <ShieldAlert className="h-7 w-7" />
            </span>
            <div>
              <h2 className="font-title text-lg font-bold text-ink">Não verificado</h2>
              <p className="text-sm text-muted">
                A verificação de identidade abre em breve — via parceiro, em estruturação.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
            <Info className="h-3.5 w-3.5" /> Disponível em breve
          </span>
        </div>

        <div className="mt-5 rounded-xl border border-sage-200 bg-surface-2 p-4">
          <p className="text-sm font-medium text-ink">O que a verificação destrava:</p>
          <ul className="mt-2 space-y-1.5">
            {copy.unlocks.map((u) => (
              <li key={u} className="flex items-start gap-2 text-sm text-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> {u}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {avisar ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-sage-100 px-4 py-2 text-sm font-medium text-forest">
              <Check className="h-4 w-4" /> Avisaremos você assim que abrir.
            </span>
          ) : (
            <Button variant="gold" onClick={registrarInteresse}>
              <BellRing className="h-4 w-4" /> Avisar-me quando abrir
            </Button>
          )}
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Você já pode se candidatar sem o selo — o proprietário vê{" "}
          <strong className="text-ink">verificação pendente</strong> no lugar do laudo até a
          verificação abrir. Seus dados serão tratados apenas para a verificação (LGPD).
        </p>
      </Panel>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MODO DEMONSTRAÇÃO (admin) — simula o fluxo até "verificado" para vitrine.
   O selo aqui é SEMPRE rotulado como demonstração e não vale para conta real.
   ───────────────────────────────────────────────────────────────────────── */
function DemoFlow({
  copy,
  mode,
}: {
  copy: VerifyCopy;
  mode: "tenant" | "owner";
}) {
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
        // Laudo usa o NOME COMPLETO do perfil (nunca o e-mail cru que o campo
        // `name` carrega como fallback técnico) — item 1 do fechamento do QA.
        body: JSON.stringify({ name: user?.fullName ?? "Inquilino" }),
      });
      setResult((await res.json()) as CafResult);
      setValidUntil(new Date(Date.now() + 90 * 86400000).toLocaleDateString("pt-BR"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <DemoBadge />
      </div>

      {!result ? (
        <Panel className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sage-100">
            <ShieldCheck className="h-8 w-8 text-forest" />
          </div>
          <h2 className="mt-4 font-title text-xl font-bold text-ink">{copy.heading}</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            Confirmamos sua <strong>identidade</strong> (documento + foto) para dar segurança à
            negociação.
          </p>
          <div className="mx-auto mt-5 max-w-md space-y-2 text-left text-sm">
            <Bullet>Identidade confirmada por documento oficial e foto (selfie).</Bullet>
            <Bullet>Análise antifraude, com resultado em 3 níveis (verde/amarelo/vermelho).</Bullet>
            <Bullet>Cobre brasileiros e estrangeiros (documento de estrangeiro CRNM/RNE).</Bullet>
          </div>
          <Button variant="gold" className="mt-6" onClick={verify} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Verificando..." : copy.button}
          </Button>
        </Panel>
      ) : (
        <>
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-champagne text-forest">
                  <BadgeCheck className="h-7 w-7" />
                </span>
                <div>
                  <h2 className="font-title text-lg font-bold text-ink">
                    {copy.badge} {TRAFFIC_LIGHT_META[result.light].emoji}
                  </h2>
                  <p className="text-sm text-muted">Verificação de demonstração</p>
                </div>
              </div>
              <VerificationBadge />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Item icon={Fingerprint} label="Identidade" ok={result.identity} />
              <Item icon={ScanFace} label="Prova de vida" ok={result.liveness} />
              <Item icon={FileCheck2} label="Documento" ok={result.document} />
            </div>

            <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Verificação de <strong>demonstração</strong> (válida só nesta vitrine). A real é
              feita <strong>via parceiro — em estruturação</strong>; só então o selo vale de fato
              e a validade de {validUntil ? `até ${validUntil}` : "90 dias"} passa a contar.
            </p>
          </Panel>

          <Panel className="flex items-start gap-3 bg-forest text-white">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-champagne" />
            <div>
              <h3 className="font-title font-bold">{copy.ctaTitle}</h3>
              <p className="text-sm text-white/80">{copy.ctaBody}</p>
            </div>
          </Panel>

          {/* Tela de sucesso do "verificado" termina com os dois caminhos
              (emenda no passo 2 do checklist de primeiro acesso do inquilino). */}
          {mode === "tenant" && (
            <Panel>
              <h3 className="font-title font-bold text-ink">Agora é encontrar seu lugar</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <ButtonLink href="/buscar" variant="primary">
                  <Search className="h-4 w-4" /> Buscar imóveis
                </ButtonLink>
                <ButtonLink href="/pedidos/novo" variant="outline">
                  <Megaphone className="h-4 w-4" /> Publicar um Pedido de Moradia
                </ButtonLink>
              </div>
            </Panel>
          )}

          <OwnerDecisionNotice />
        </>
      )}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-muted">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
      <span>{children}</span>
    </p>
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
