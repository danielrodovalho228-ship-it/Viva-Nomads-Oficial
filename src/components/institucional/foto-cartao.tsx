import { BrandImage } from "@/components/brand-image";
import type { CartaoSecao } from "@/lib/cartoes-secao";

export const SELO_ILUSTRATIVA = "Imagem ilustrativa";

/**
 * Foto no topo do cartão de seção (16:9). Sem arquivo ainda, fundo neutro do tema (sem ícone). Foto gerada por briefing
 * leva o selo "Imagem ilustrativa" no canto (adendo EMPRESAS-A): nada de foto que pareça real sem ser.
 */
export function FotoCartao({ cartao }: { cartao: CartaoSecao }) {
  if (!cartao.fotoPronta) {
    return <div className="aspect-[16/9] w-full bg-sage-100" data-testid="cartao-foto-pendente" aria-hidden />;
  }
  return (
    <div className="relative">
      <BrandImage src={cartao.foto} alt={cartao.alt} rounded="rounded-none" sizes="(max-width: 768px) 100vw, 33vw" className="aspect-[16/9] w-full" />
      {cartao.ilustrativa && (
        <span data-testid="selo-ilustrativa" className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-night/70 px-2 py-1 text-xs font-semibold text-white">
          {SELO_ILUSTRATIVA}
        </span>
      )}
    </div>
  );
}
