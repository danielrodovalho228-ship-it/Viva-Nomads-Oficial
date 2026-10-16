import Image from "next/image";
import Link from "next/link";
import { BRAND_BLUR } from "@/lib/media";
import { CAPAS, type CapaPainel } from "@/components/dashboard/capas";
import { cn } from "@/lib/utils";
import { ArrowUpRight, HardHat } from "lucide-react";

/**
 * Placeholder padrão "Em construção" — SEMPRE dentro da casca do dashboard.
 *
 * REGRA DEFINITIVA (QA 10/07, revoga a anterior): este placeholder é EXCLUSIVO
 * para rota que AINDA NÃO EXISTE no código (nasce apontada no menu antes da
 * tela). Página JÁ CONSTRUÍDA **nunca** regride para este placeholder — na
 * dúvida, pergunte antes de rebaixar. (Simulador, ROI, Orçamentos e Garantias
 * já existem e renderizam a ferramenta real; foram reativados após uma
 * regressão que os havia trocado por este placeholder.)
 */
export function EmConstrucao({
  title,
  text = "Estamos finalizando esta área. Em breve ela aparece aqui, dentro do seu painel.",
}: {
  title: string;
  text?: string;
}) {
  return (
    <>
      <PageTitle title={title} subtitle="Em construção" />
      <EmptyState
        icon={HardHat}
        title="Em construção"
        text={text}
      />
    </>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
  capa,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Foto de capa da tela (CAPAS). Com ela, o título vira uma faixa full-width com imagem. */
  capa?: CapaPainel;
}) {
  if (capa) {
    const foto = CAPAS[capa];
    // Faixa de capa: foto cobrindo toda a largura do conteúdo, véu escuro da
    // esquerda para a direita (legibilidade) e ação à direita no desktop / abaixo
    // do texto no mobile. Altura mínima fixa para todas as telas ficarem iguais.
    return (
      <header
        data-testid="painel-capa"
        data-capa={capa}
        className="relative mb-6 overflow-hidden rounded-2xl bg-night sm:mb-8"
      >
        <Image
          src={foto.src}
          alt={foto.alt}
          fill
          priority
          sizes="(min-width: 1024px) 75vw, 100vw"
          placeholder="blur"
          blurDataURL={BRAND_BLUR}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-night/90 via-night/65 to-night/15" />
        <div className="relative flex min-h-[176px] flex-col justify-end gap-4 p-5 sm:min-h-[220px] sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div className="max-w-2xl">
            <h1 className="font-title text-2xl font-bold text-white sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-white/85 sm:text-base">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </header>
    );
  }
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8 sm:gap-4">
      <div>
        <h1 className="font-title text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted sm:text-base">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  /** Opcional: transforma o card num atalho para a seção correspondente. */
  href?: string;
  /** Opcional: contexto curto sob o número (comparação ou próxima ação). */
  hint?: string;
}) {
  // Compacto no mobile (ADENDO item 1): rótulo pequeno + ícone reduzido + número
  // menor, padding enxuto (~72px de altura) para caber 3 numa linha a 390px. A
  // partir de sm volta ao card cheio. Rótulo trunca para não quebrar a grade.
  const body = (
    <>
      <div className="flex items-center justify-between gap-1.5">
        <span className="min-w-0 truncate text-[11px] leading-tight text-muted sm:text-sm">
          {label}
        </span>
        <Icon className="h-4 w-4 shrink-0 text-sage sm:h-5 sm:w-5" />
      </div>
      <p className="mt-1 font-title text-xl font-bold text-forest sm:mt-2 sm:text-3xl">{value}</p>
      {hint && (
        <p data-testid="stat-hint" className="mt-1 text-[11px] leading-snug text-muted sm:text-xs">
          {hint}
        </p>
      )}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="group relative block rounded-2xl border border-sage-200 bg-white p-3 transition-colors hover:border-sage sm:p-5"
      >
        {body}
        <ArrowUpRight className="absolute bottom-3 right-3 hidden h-4 w-4 text-sage-200 transition-colors group-hover:text-sage sm:bottom-4 sm:right-4 sm:block" />
      </Link>
    );
  }
  return <div className="rounded-2xl border border-sage-200 bg-white p-3 sm:p-5">{body}</div>;
}

export function Panel({
  title,
  children,
  className,
  ...resto
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, "title" | "children" | "className">) {
  // Container-base do painel: padding compacto no mobile (ADENDO item 5 — token
  // central, não correção tela a tela), espaçoso a partir de sm. `min-w-0` é
  // essencial: como item de grid/flex, sem ele o padrão `min-width:auto` deixa
  // conteúdo com `truncate` (nowrap) esticar a coluna além da viewport — era a
  // origem do scroll horizontal a 390px na lista "Imóveis recomendados".
  return (
    <section {...resto} className={cn("min-w-0 rounded-2xl border border-sage-200 bg-white p-4 sm:p-6", className)}>
      {title && <h2 className="mb-3 font-title text-lg font-bold text-ink sm:mb-4">{title}</h2>}
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  text,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  illustration?: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  // Compacto no mobile (ADENDO item 4): padding ~24px e ilustração/ícone menores;
  // a partir de sm volta ao card espaçoso (p-12, ícone maior).
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white p-6 text-center sm:p-12">
      {illustration ? (
        <div className="flex justify-center">{illustration}</div>
      ) : (
        Icon && <Icon className="mx-auto h-8 w-8 text-blue-500 sm:h-10 sm:w-10" />
      )}
      <h3 className="mt-3 font-title text-base font-bold text-ink sm:mt-4 sm:text-lg">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{text}</p>
      {action && <div className="mt-5 sm:mt-6">{action}</div>}
    </div>
  );
}
