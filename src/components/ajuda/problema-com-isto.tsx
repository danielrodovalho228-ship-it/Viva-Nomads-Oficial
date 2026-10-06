import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Problema com isto?" — abre a Central de Ajuda com o chamado já ligado ao
 * pedido, contrato ou anúncio (o servidor confere se é mesmo da pessoa).
 */
export function ProblemaComIsto({
  tipo,
  id,
  className,
}: {
  tipo: "pedido" | "contrato" | "anuncio";
  id: string;
  className?: string;
}) {
  return (
    <Link
      href={`/ajuda?contexto=${tipo}&id=${encodeURIComponent(id)}`}
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-muted underline-offset-2 hover:text-forest hover:underline", className)}
    >
      <LifeBuoy className="h-3.5 w-3.5" /> Problema com isto?
    </Link>
  );
}
