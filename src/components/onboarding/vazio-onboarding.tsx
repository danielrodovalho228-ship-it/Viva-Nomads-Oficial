import { ButtonLink } from "@/components/ui/button";
import type { VazioOnboarding } from "@/lib/onboarding/vazios";

/** Estado vazio do onboarding (Prompt 43): uma frase do que acontece aqui + o próximo passo. Sem ilustração. */
export function VazioOnboardingBloco({ vazio, testId }: { vazio: VazioOnboarding; testId?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-6" data-testid={testId ?? "vazio-onboarding"}>
      <p className="text-sm text-ink">{vazio.frase}</p>
      <ButtonLink href={vazio.acao.href} variant="secondary" size="sm" className="mt-4">
        {vazio.acao.rotulo}
      </ButtonLink>
    </div>
  );
}
