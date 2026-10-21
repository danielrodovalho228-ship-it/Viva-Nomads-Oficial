import { BrandImage } from "@/components/brand-image";
import type { CartaoSecao } from "@/lib/cartoes-secao";

/** Foto no topo do cartão de seção (16:9). Sem arquivo ainda, fundo neutro do tema (sem ícone). */
export function FotoCartao({ cartao }: { cartao: CartaoSecao }) {
  if (!cartao.fotoPronta) {
    return <div className="aspect-[16/9] w-full bg-sage-100" data-testid="cartao-foto-pendente" aria-hidden />;
  }
  return (
    <BrandImage src={cartao.foto} alt={cartao.alt} rounded="rounded-none" sizes="(max-width: 768px) 100vw, 33vw" className="aspect-[16/9] w-full" />
  );
}
