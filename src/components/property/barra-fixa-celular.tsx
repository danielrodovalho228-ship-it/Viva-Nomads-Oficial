"use client";

import { Check, FileSignature, MessageCircle, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { buttonClasses } from "@/components/ui/button";
import type { BarraFixaImovel } from "@/lib/barra-fixa-imovel";

/**
 * Barra fixa no rodapé do celular (< lg) da página do imóvel: valor por mês,
 * "Caução e taxas no detalhe" (leva ao cartão de preço) e as MESMAS três ações do
 * cartão do computador: Enviar candidatura / Mensagem / WhatsApp (da Viva).
 * Fica acima da barra de abas (.vn-barra-fixa); `data-cta` na barra faz o botão flutuante
 * "Fale com a Viva" subir acima dela em vez de cobrir valor e botões.
 * O link "Caução e taxas" nunca é cortado e tem alvo de toque de 44 px (ordem c9d21980, D1);
 * ao voltar pelo cache de página (bfcache do Safari) a página é recarregada para a barra
 * mostrar os dados do próprio imóvel (D2).
 */
export function BarraFixaCelular({
  barra,
  pending,
  onSolicitar,
  onMensagem,
  whatsapp,
}: {
  barra: BarraFixaImovel;
  pending: boolean;
  onSolicitar: () => void;
  onMensagem: () => void;
  whatsapp: { href: string; externo: boolean; rotulo: string };
}) {
  const router = useRouter();
  useEffect(() => {
    const aoVoltar = (e: PageTransitionEvent) => {
      if (e.persisted) router.refresh();
    };
    window.addEventListener("pageshow", aoVoltar);
    return () => window.removeEventListener("pageshow", aoVoltar);
  }, [router]);
  if (!barra.visivel) return null;
  const primario = buttonClasses({ variant: "primary", size: "sm", className: "h-11 px-3" });
  const secundario = buttonClasses({ variant: "secondary", size: "sm", className: "h-11 px-3" });
  return (
    <div
      data-testid="barra-fixa-imovel"
      data-cta
      className="vn-barra-fixa fixed inset-x-0 z-30 border-t border-line bg-white px-4 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] lg:hidden print:hidden"
    >
      <div className="mx-auto max-w-xl">
        {barra.demonstracao && (
          <p data-testid="barra-demo" className="text-[11px] leading-snug text-muted">
            Anúncio de exemplo: esta solicitação não é enviada.
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <Link
            href="#cartao-preco"
            data-testid="barra-total"
            aria-label={`Total por mês ${barra.valor}: ver caução e taxas no detalhe`}
            className="flex min-h-11 min-w-0 flex-1 flex-col justify-center"
          >
            <span>
              <span className="font-title text-lg font-bold text-forest">{barra.valor}</span>
              <span className="text-sm text-muted"> /mês total</span>
            </span>
            <span data-testid="barra-detalhe" className="text-[11px] leading-snug text-muted underline">
              {barra.linha}
            </span>
          </Link>
          <span data-testid="barra-status" className="max-w-[45%] text-right text-xs font-semibold leading-snug text-forest">
            {barra.status}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
          {barra.estado === "candidatou" ? (
            <Link href="/dashboard/mensagens" className={buttonClasses({ variant: "secondary", size: "sm", className: "h-11 px-3" })}>
              <Check className="h-4 w-4" /> Candidatura enviada
            </Link>
          ) : (
            <button type="button" onClick={onSolicitar} disabled={pending} className={primario}>
              <FileSignature className="h-4 w-4" />
              {pending ? "Enviando..." : "Enviar candidatura"}
            </button>
          )}
          <button type="button" onClick={onMensagem} aria-label="Enviar mensagem" className={secundario}>
            <MessageSquare className="h-4 w-4" /> <span>Mensagem</span>
          </button>
          <a
            href={whatsapp.href}
            {...(whatsapp.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            aria-label={whatsapp.rotulo}
            className={secundario}
          >
            <MessageCircle className="h-4 w-4" /> <span className="sr-only sm:not-sr-only">{whatsapp.externo ? "WhatsApp" : "Viva"}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
