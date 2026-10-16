import { Check, FileSignature, MessageCircle, MessageSquare } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import type { BarraFixaImovel } from "@/lib/barra-fixa-imovel";

/**
 * Barra fixa no rodapé do celular (< lg) da página do imóvel: valor por mês,
 * "Caução e taxas no detalhe" (leva ao cartão de preço) e as MESMAS três ações do
 * cartão do computador: Solicitar reserva / Mensagem / WhatsApp (da Viva).
 * Fica acima da barra de abas (.vn-barra-fixa); `data-cta` na barra faz o botão flutuante
 * "Fale com a Viva" subir acima dela em vez de cobrir valor e botões.
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
        <p className="truncate">
          <span className="font-title text-lg font-bold text-forest">{barra.valor}</span>
          <span className="text-sm text-muted"> /mês</span>
          <span className="text-muted"> · </span>
          <span className="text-xs font-semibold text-forest" data-testid="barra-status">{barra.status}</span>
        </p>
        <p className="truncate text-[11px] text-muted">
          {barra.demonstracao && (
            <>
              <span data-testid="barra-demo">Anúncio de exemplo: esta solicitação não é enviada.</span>
              <span> · </span>
            </>
          )}
          <Link href="#cartao-preco" className="underline">
            {barra.linha}
          </Link>
        </p>
        <div className="mt-1.5 grid grid-cols-[1fr_auto_auto] items-center gap-2">
          {barra.estado === "candidatou" ? (
            <Link href="/dashboard/mensagens" className={buttonClasses({ variant: "secondary", size: "sm", className: "h-11 px-3" })}>
              <Check className="h-4 w-4" /> Candidatura enviada
            </Link>
          ) : (
            <button type="button" onClick={onSolicitar} disabled={pending} className={primario}>
              <FileSignature className="h-4 w-4" />
              {pending ? "Enviando..." : "Solicitar reserva"}
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
