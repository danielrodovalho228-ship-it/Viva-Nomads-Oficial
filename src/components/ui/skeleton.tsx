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

/**
 * Esqueleto da página do imóvel (Prompt 48): a mesma largura, a galeria (4:3 no celular, 480 px no desktop), a linha
 * de seções e as duas colunas — conteúdo e cartão de preço — do PropertyDetail.
 */
export function SkeletonDetalheImovel() {
  return (
    <div role="status" aria-label="Carregando o imóvel" className="mx-auto w-full max-w-[1536px] px-4 py-8 sm:px-8 lg:px-8" data-testid="skeleton-detalhe">
      <Skeleton className="aspect-[4/3] w-full rounded-xl md:aspect-auto md:h-[480px]" />
      <Skeleton className="mt-4 h-8 w-full max-w-xl" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem] xl:gap-12">
        <div className="min-w-0 space-y-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-8 h-32 w-full" />
        </div>
        <Skeleton className="hidden h-64 w-full rounded-xl lg:block" />
      </div>
    </div>
  );
}

/** Esqueleto de tabela do admin (Prompt 48): cabeçalho e linhas com as colunas da tabela que vai chegar. */
export function SkeletonTabela({ linhas = 6, colunas = 4 }: { linhas?: number; colunas?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="overflow-hidden rounded-xl border border-line bg-white" data-testid="skeleton-tabela">
      <div className="grid gap-4 border-b border-line px-4 py-3" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
        {Array.from({ length: colunas }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-2/3" />
        ))}
      </div>
      {Array.from({ length: linhas }).map((_, l) => (
        <div key={l} className="grid gap-4 border-b border-line px-4 py-4 last:border-b-0" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
          {Array.from({ length: colunas }).map((_, i) => (
            <Skeleton key={i} className={i === 0 ? "h-4 w-full" : "h-4 w-1/2"} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Esqueleto do painel do admin (Prompt 48): título, faixa de números e uma tabela. */
export function SkeletonAdmin() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6" data-testid="skeleton-admin">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <SkeletonTabela />
    </div>
  );
}

/**
 * Esqueleto das mensagens (Prompt 48): a mesma caixa de 70 % da tela, a lista de conversas à esquerda (avatar, nome,
 * prévia) e, no desktop, a conversa aberta com balões dos dois lados.
 */
export function SkeletonMensagens() {
  return (
    <div role="status" aria-label="Carregando as conversas" className="grid h-[75vh] overflow-hidden rounded-xl border border-sage-200 bg-white md:h-[70vh] md:grid-cols-3" data-testid="skeleton-mensagens">
      <div className="space-y-1 border-r border-sage-200 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg p-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden flex-col gap-4 p-4 md:col-span-2 md:flex">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="ml-auto h-12 w-1/2" />
        <Skeleton className="h-16 w-3/5" />
        <Skeleton className="mt-auto h-12 w-full rounded-full" />
      </div>
    </div>
  );
}

/** Esqueleto de um mês do calendário (Prompt 48): título e a grade 7 × 6 do CalendarioMes. */
export function SkeletonCalendario({ meses = 1 }: { meses?: number }) {
  return (
    <div role="status" aria-label="Carregando o calendário" className="grid gap-4 sm:grid-cols-2" data-testid="skeleton-calendario">
      {Array.from({ length: meses }).map((_, m) => (
        <div key={m} className="rounded-xl border border-line bg-white p-3">
          <Skeleton className="mx-auto mb-2 h-4 w-32" />
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 42 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Esqueleto de bloco de texto (Prompt 48): algumas linhas no lugar de "Carregando…" com spinner. */
export function SkeletonLinhas({ linhas = 3, testid }: { linhas?: number; testid?: string }) {
  return (
    <div role="status" aria-label="Carregando" className="space-y-2" data-testid={testid}>
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton key={i} className={i === linhas - 1 ? "h-4 w-1/2" : "h-4 w-full"} />
      ))}
    </div>
  );
}
