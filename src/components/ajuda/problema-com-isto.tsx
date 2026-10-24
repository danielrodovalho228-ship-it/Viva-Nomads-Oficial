import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Problema com isto?" — abre a Central de Ajuda com o chamado já ligado ao
 * pedido, contrato, anúncio ou parceiro (o servidor confere se é mesmo da pessoa; anúncio e parceiro publicado
 * qualquer conta denuncia).
 */
export function ProblemaComIsto({
  tipo,
  id,
  className,
}: {
  tipo: "pedido" | "contrato" | "anuncio" | "parceiro" | "perfil";
  id: string;
  className?: string;
}) {
  return (
    <Link
      href={`/ajuda?contexto=${tipo}&id=${encodeURIComponent(id)}`}
      className={cn("inline-flex items-center gap-2 text-xs font-medium text-muted underline-offset-2 hover:text-forest hover:underline", className)}
    >
      <LifeBuoy className="h-3.5 w-3.5" /> Problema com isto?
    </Link>
  );
}
