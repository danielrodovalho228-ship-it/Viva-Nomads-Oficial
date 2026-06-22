"use client";

import { Lock } from "lucide-react";
import { useAuthStore, DEMO_USER, type SubscriptionPlan } from "@/lib/store";
import { PLAN_RANK, PLAN_LABEL } from "@/lib/plan";
import { ButtonLink } from "@/components/ui/button";
import { PageTitle, Panel } from "@/components/dashboard/primitives";

/**
 * Libera o conteúdo apenas para o plano mínimo exigido (default: Gestor).
 * Caso contrário, exibe um estado bloqueado com CTA para upgrade.
 */
export function PlanGate({
  min = "gestor",
  title,
  children,
}: {
  min?: SubscriptionPlan;
  title: string;
  children: React.ReactNode;
}) {
  const { user } = useAuthStore();
  const plan = (user ?? DEMO_USER).plan ?? "free";

  if (PLAN_RANK[plan] >= PLAN_RANK[min]) return <>{children}</>;

  const minLabel = PLAN_LABEL[min];

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title={title} />
      <Panel className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage-100">
          <Lock className="h-7 w-7 text-forest" />
        </div>
        <h2 className="mt-4 font-title text-xl font-bold text-ink">
          Recurso do plano {minLabel}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Esta ferramenta faz parte do plano <strong>{minLabel}</strong>, voltado a
          administradoras e operadores de carteira. Faça upgrade para liberar.
        </p>
        <ButtonLink href="/dashboard/assinatura" variant="gold" className="mt-6">
          Ver planos
        </ButtonLink>
      </Panel>
    </div>
  );
}
