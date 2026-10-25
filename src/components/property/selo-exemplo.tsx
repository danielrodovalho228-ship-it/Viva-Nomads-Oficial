import { SELO_EXEMPLO } from "@/config/exemplo-proprietarios";

/** Selo "Exemplo ilustrativo": marca TODO dado de demonstração (prompt 9). */
export function SeloExemplo({ className = "" }: { className?: string }) {
  return (
    <span
      data-testid="selo-exemplo"
      className={`inline-flex shrink-0 items-center rounded-full bg-night/85 px-3 py-1 text-xs font-semibold text-white ${className}`}
    >
      {SELO_EXEMPLO}
    </span>
  );
}
