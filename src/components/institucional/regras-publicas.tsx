import { regrasPublicas } from "@/lib/ajuda/regras-publicas";
import { PRE_ACEITACAO_72H_ATIVA } from "@/lib/flags";

/**
 * Família 6 (lote da Ajuda): E956 (pré-aceite, só com a chave ligada), E957 (CPF/RG recusado com aviso) e E958, metade
 * E948 (prazos da Viva), declarados em /como-funciona e na home pela mesma fonte da Ajuda (lib/ajuda/regras-publicas.ts).
 */
export function RegrasPublicas({ className = "" }: { className?: string }) {
  const regras = regrasPublicas(PRE_ACEITACAO_72H_ATIVA);
  return (
    <div className={`grid gap-4 ${regras.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"} ${className}`} data-testid="regras-publicas">
      {regras.map((r) => (
        <div key={r.id} className="rounded-xl border border-line bg-white p-4" data-testid={`regra-${r.id}`}>
          <h3 className="text-sm font-semibold text-ink">{r.titulo}</h3>
          <p className="mt-1 text-sm text-muted">{r.texto}</p>
        </div>
      ))}
    </div>
  );
}
