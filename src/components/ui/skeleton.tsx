import { cn } from "@/lib/utils";

/** Bloco cinza de carregamento (esqueleto) — no lugar de tela branca. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-divisor", className)} />;
}

/**
 * Esqueleto do cartão de anúncio (Prompt 40): o formato EXATO do PropertyCard —
 * foto 4:3 com raio de 12 px, bairro e cidade, título, linha-síntese e valor mensal.
 */
export function SkeletonCartao() {
  return (
    <div aria-hidden className="flex flex-col gap-3" data-testid="skeleton-cartao">
      <Skeleton className="aspect-[4/3] w-full rounded-xl" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-1 h-6 w-1/3" />
      </div>
    </div>
  );
}

/** Grade de esqueletos de cartão (busca, favoritos). Número par de itens. */
export function SkeletonGradeCartoes({ itens = 6, className }: { itens?: number; className?: string }) {
  return (
    <div role="status" aria-label="Carregando imóveis" className={cn("grid gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-x-6 xl:grid-cols-3", className)}>
      {Array.from({ length: itens }).map((_, i) => (
        <SkeletonCartao key={i} />
      ))}
    </div>
  );
}

/** Esqueleto de lista de cartões (busca, imóveis, favoritos, mensagens). */
export function SkeletonLista({ itens = 4 }: { itens?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="space-y-4">
      <Skeleton className="h-7 w-44" />
      {Array.from({ length: itens }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-xl bg-white p-3">
          <Skeleton className="h-20 w-24 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
