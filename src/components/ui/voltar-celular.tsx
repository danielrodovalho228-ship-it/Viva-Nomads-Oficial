"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { marcarNavInterna, veioDeDentroDoSite } from "@/lib/navegacao/voltar";

/**
 * E69 (QA 24/10): o "voltar" das subtelas da Conta no celular. Volta para ONDE A PESSOA ESTAVA (o histórico do
 * navegador) quando ela chegou de outra tela do site; aberta direto (link, e-mail, recarga), vai para o destino
 * padrão. Sem JavaScript, é um link comum para o destino padrão. No computador não aparece: o menu lateral navega.
 */
export function VoltarCelular({ padrao, rotulo, className, testId = "conta-voltar" }: { padrao: string; rotulo: string; className?: string; testId?: string }) {
  const router = useRouter();
  return (
    <Link
      href={padrao}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        if (veioDeDentroDoSite(document.referrer, window.location.origin, window.history.length)) {
          e.preventDefault();
          router.back();
        }
      }}
      className={cn("inline-flex min-h-11 min-w-11 items-center justify-center text-ink lg:hidden", className)}
      aria-label={`Voltar para ${rotulo}`}
      data-testid={testId}
    >
      <ChevronLeft className="h-6 w-6" aria-hidden />
    </Link>
  );
}

/** Montado uma vez na casca do painel: houve troca de rota dentro do site → o "voltar" pode usar o histórico. */
export function MarcaNavInterna() {
  const pathname = usePathname();
  const [inicial] = useState(pathname);
  useEffect(() => {
    if (pathname !== inicial) marcarNavInterna();
  }, [pathname, inicial]);
  return null;
}
