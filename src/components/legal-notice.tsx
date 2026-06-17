import { Scale, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

/** Moldura jurídica das ordens de serviço (Bloco C — rodada 5). */
export function ServiceOrderNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted",
        className
      )}
    >
      <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
      <span>
        O Viva Nomads <strong className="text-ink">registra e notifica</strong> solicitações.
        A execução e o prazo da manutenção são responsabilidade do proprietário e do inquilino,
        conforme o contrato.
      </span>
    </p>
  );
}

/**
 * Aviso da posição jurídica da plataforma (seção 8.6).
 * O Viva Nomads é conectador — não é locador, fiador ou garantidor.
 */
export function PlatformLegalNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-sage-200 bg-surface-2 px-4 py-3 text-sm text-muted",
        className
      )}
    >
      <Scale className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
      <p>
        O Viva Nomads <strong className="text-forest">conecta, verifica e documenta</strong> —
        não é locador, fiador nem garantidor, e não responde pelo aluguel. A decisão de alugar
        é exclusivamente do proprietário.
      </p>
    </div>
  );
}

/** Variante de destaque para a decisão sobre o inquilino (8.1). */
export function OwnerDecisionNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800",
        className
      )}
    >
      <span aria-hidden>⚠️</span>
      <span>
        Esta é uma análise <strong>informativa</strong>. A decisão de alugar é exclusivamente
        do proprietário — a plataforma nunca aprova ou reprova o inquilino.
      </span>
    </p>
  );
}
