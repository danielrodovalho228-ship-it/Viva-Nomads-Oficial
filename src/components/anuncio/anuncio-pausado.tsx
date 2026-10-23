import { ButtonLink } from "@/components/ui/button";

/**
 * 64-B: a página pública de um anúncio PAUSADO (pelo dono ou pela Viva). Quem chega por um link já compartilhado vê
 * que o anúncio existe mas não está recebendo pedidos — sem preço, sem fotos e sem botão de pedido — e segue a busca.
 */
export function AnuncioPausado({ titulo, cidade }: { titulo: string; cidade: string | null }) {
  const busca = cidade ? `/buscar?cidade=${encodeURIComponent(cidade)}` : "/buscar";
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6" data-testid="anuncio-pausado">
      <p className="text-sm font-semibold text-muted">Este anúncio está pausado</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink sm:text-[28px]">{titulo}</h1>
      <p className="mt-3 text-ink/80">
        O proprietário não está recebendo pedidos para este imóvel agora. Quando ele voltar a ser anunciado, aparece de novo na busca
        {cidade ? ` de ${cidade}` : ""}.
      </p>
      <div className="mt-6">
        <ButtonLink href={busca}>{cidade ? `Ver imóveis em ${cidade}` : "Buscar imóveis"}</ButtonLink>
      </div>
    </div>
  );
}
