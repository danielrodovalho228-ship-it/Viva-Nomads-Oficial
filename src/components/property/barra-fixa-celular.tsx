import { Check, FileSignature } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { BarraFixaImovel } from "@/lib/barra-fixa-imovel";

/**
 * Barra fixa no rodapé do celular (< lg) da página do imóvel: valor por mês,
 * "Caução e taxas no detalhe" (leva ao cartão de preço) e o botão principal, que
 * dispara a mesma ação do cartão. Fica acima da barra de abas (.vn-barra-fixa).
 */
export function BarraFixaCelular({
  barra,
  pending,
  onCandidatar,
}: {
  barra: BarraFixaImovel;
  pending: boolean;
  onCandidatar: () => void;
}) {
  if (!barra.visivel) return null;
  return (
    <div
      data-testid="barra-fixa-imovel"
      className="vn-barra-fixa fixed inset-x-0 z-30 border-t border-line bg-white px-4 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] lg:hidden print:hidden"
    >
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate">
            <span className="font-title text-lg font-bold text-forest">{barra.valor}</span>
            <span className="text-sm text-muted"> /mês</span>
          </p>
          <p className="truncate text-xs">
            <span className="font-semibold text-forest" data-testid="barra-status">{barra.status}</span>
            <span className="text-muted"> · </span>
            <Link href="#cartao-preco" className="text-muted underline">
              {barra.linha}
            </Link>
          </p>
        </div>
        {barra.estado === "candidatou" ? (
          <Link
            href="/dashboard/mensagens"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sage-100 px-4 py-2.5 text-sm font-semibold text-forest"
          >
            <Check className="h-4 w-4" /> Candidatura enviada
          </Link>
        ) : (
          <Button variant="gold" size="md" className="shrink-0" onClick={onCandidatar} disabled={pending}>
            <FileSignature className="h-4 w-4" />
            {pending ? "Enviando..." : "Candidatar-se"}
          </Button>
        )}
      </div>
    </div>
  );
}
