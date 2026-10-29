import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { ROTULO_PAPEL, type ChecklistAtivacao } from "@/lib/onboarding/ativacao";
import { cn } from "@/lib/utils";

/**
 * Checklist de ativação de um papel (Prompt 43, adendo de onboarding): lista com check e a ação dentro do item, sem
 * barra nem porcentagem. Fica no topo do Início até a ativação e some sozinho (quem decide é checklistsDoInicio).
 */
export function ChecklistAtivacaoBloco({ checklist, embutido = false }: { checklist: ChecklistAtivacao; embutido?: boolean }) {
  // E218: "embutido" = dentro do bloco principal do Início do dono (sem a moldura própria).
  return (
    <section
      className={cn(embutido ? "mt-6 border-t border-line pt-4" : "mb-6 rounded-xl border border-line bg-white p-4 sm:p-6")}
      data-testid="checklist-ativacao"
      data-papel={checklist.papel}
      data-lugar={embutido ? "dentro" : undefined}
    >
      <p className="text-xs font-semibold text-muted">{ROTULO_PAPEL[checklist.papel]}</p>
      <h2 className="font-title text-lg font-semibold text-ink">{checklist.titulo}</h2>
      <ul className="mt-3 divide-y divide-line">
        {checklist.itens.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3" data-item={i.id} data-feito={i.feito ? "1" : "0"}>
            <span className="flex min-w-0 items-start gap-3">
              {i.feito ? (
                <Check className="mt-1 h-4 w-4 shrink-0 text-forest" aria-hidden />
              ) : (
                <Circle className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden />
              )}
              <span className="min-w-0">
                <span className={i.feito ? "block text-sm text-muted line-through" : "block text-sm font-semibold text-ink"}>
                  {i.texto}
                  {i.feito && <span className="sr-only"> — feito</span>}
                </span>
                {i.detalhe && <span className="block text-sm text-muted">{i.detalhe}</span>}
              </span>
            </span>
            {i.acao && (
              <Link href={i.acao.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-forest">
                {i.acao.rotulo}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
