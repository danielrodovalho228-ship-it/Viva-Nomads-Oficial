import { ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { SEUS_DADOS_REGRAS } from "@/lib/conta/seus-dados-regras";

/**
 * E67b (decidido pelo Daniel, 24/10) — o cartão final e curto de "Meus dados": o que a Viva guarda e por quanto tempo
 * (a regra é a do inventário de retenção, src/lib/minimizacao/regras.ts: documento conferido sai 30 dias depois da
 * decisão; fica só o veredito) e o caminho para a Privacidade, onde se baixa os dados.
 */
export function SeusDadosRegras() {
  return (
    <section className="rounded-xl bg-white p-4 sm:p-6" aria-labelledby="seus-dados-regras-titulo" data-testid="seus-dados-regras">
      <h2 id="seus-dados-regras-titulo" className="flex items-center gap-2 font-title text-lg font-semibold text-ink">
        <ShieldCheck className="h-5 w-5 shrink-0 text-forest" aria-hidden /> {SEUS_DADOS_REGRAS.titulo}
      </h2>
      <ul className="mt-2 grid gap-1 text-sm text-ink">
        {SEUS_DADOS_REGRAS.linhas.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <ButtonLink href="/dashboard/conta/privacidade" variant="secondary" className="mt-4 w-full sm:w-auto" data-testid="seus-dados-privacidade">
        {SEUS_DADOS_REGRAS.botao}
      </ButtonLink>
    </section>
  );
}
