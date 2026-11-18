import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";
import { HREF_FALE_COM_A_VIVA } from "@/lib/ajuda/rotas";

/**
 * "Problema com isto?" — abre a Central de Ajuda com o chamado já ligado ao
 * pedido, contrato, anúncio ou parceiro (o servidor confere se é mesmo da pessoa; anúncio e parceiro publicado
 * qualquer conta denuncia).
 * E13 (t442): liga direto à página do atendimento — antes passava pelo hub /ajuda, que redirecionava no servidor.
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
      href={`${HREF_FALE_COM_A_VIVA}?contexto=${tipo}&id=${encodeURIComponent(id)}`}
      className={cn("inline-flex items-center gap-2 text-xs font-medium text-muted underline-offset-2 hover:text-forest hover:underline", className)}
    >
      <LifeBuoy className="h-3.5 w-3.5" /> Problema com isto?
    </Link>
  );
}
