import Image from "next/image";
import { cn } from "@/lib/utils";
import { SOMBRA_CARTAO_CONTA } from "@/lib/conta/visual-mockup";

/**
 * O cartão da Conta com foto pequena à esquerda (padrão aprovado nos Papéis, perfil-03-papeis-com-fotos): a mesma
 * medida em todos os cartões da tela, o conteúdo à direita. Foto do acervo da plataforma, nunca do usuário.
 */
export function CartaoComFoto({ foto, testId, rotulo, children }: { foto: string; testId: string; rotulo?: string; children: React.ReactNode }) {
  return (
    <section className={cn("flex items-start gap-4 rounded-xl bg-white p-4 sm:gap-6 sm:p-6", SOMBRA_CARTAO_CONTA)} aria-label={rotulo} data-testid={testId}>
      <span className="relative block aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:aspect-[5/4] sm:w-44" data-testid="cartao-foto">
        <Image src={foto} alt="" fill sizes="(min-width: 640px) 176px, 96px" className="object-cover" />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
