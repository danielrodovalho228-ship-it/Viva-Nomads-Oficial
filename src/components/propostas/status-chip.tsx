import { STATUS_PROPOSTA, type StatusProposta } from "@/lib/propostas/regras";
import { cn } from "@/lib/utils";

const TOM: Record<(typeof STATUS_PROPOSTA)[StatusProposta]["tom"], string> = {
  neutro: "bg-surface-2 text-muted",
  info: "bg-blue-50 text-blue-700",
  alerta: "bg-amber-50 text-amber-800",
  ok: "bg-sage-100 text-forest",
  erro: "bg-red-50 text-red-700",
};

/** Etiqueta do status da proposta (a mesma na lista, no detalhe e no cartão da conversa). */
export function StatusChip({ status, className }: { status: StatusProposta; className?: string }) {
  const s = STATUS_PROPOSTA[status];
  return (
    <span className={cn("inline-flex shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold", TOM[s.tom], className)} data-testid="proposta-status" data-status={status}>
      {s.rotulo}
    </span>
  );
}
