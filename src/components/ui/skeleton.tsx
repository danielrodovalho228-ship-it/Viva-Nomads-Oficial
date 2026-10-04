import { cn } from "@/lib/utils";

/** Bloco cinza de carregamento (esqueleto) — no lugar de tela branca. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-sage-100", className)} />;
}

/** Esqueleto de lista de cartões (busca, imóveis, favoritos, mensagens). */
export function SkeletonLista({ itens = 4 }: { itens?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="space-y-4">
      <Skeleton className="h-7 w-44" />
      {Array.from({ length: itens }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-2xl bg-white p-3">
          <Skeleton className="h-20 w-24 shrink-0" />
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
