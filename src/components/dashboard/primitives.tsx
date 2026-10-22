import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowUpRight, HardHat } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

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
        text={text} action={<ButtonLink href="/dashboard" variant="secondary" size="sm">Voltar ao Início</ButtonLink>} />
    </>
  );
}

/**
 * Título das telas logadas (Prompt 42, item 2): título, subtítulo curto e uma ação opcional — sem faixa de foto.
 * A capa fotográfica ocupava um quarto da tela sem informação nenhuma; as páginas públicas seguem com as fotos delas.
 */
export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8 sm:gap-4">
      <div className="min-w-0">
        <h1 className="font-title text-2xl font-semibold text-ink sm:text-[28px]">{title}</h1>
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
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] leading-tight text-muted sm:text-sm">
          {label}
        </span>
        <Icon className="h-4 w-4 shrink-0 text-sage sm:h-5 sm:w-5" />
      </div>
      <p className="mt-1 font-title text-xl font-semibold text-forest sm:mt-2 sm:text-2xl">{value}</p>
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
        className="group relative block rounded-xl border border-sage-200 bg-white p-3 transition-colors hover:border-sage sm:p-5"
      >
        {body}
        <ArrowUpRight className="absolute bottom-3 right-3 hidden h-4 w-4 text-sage-200 transition-colors group-hover:text-sage sm:bottom-4 sm:right-4 sm:block" />
      </Link>
    );
  }
  return <div className="rounded-xl border border-sage-200 bg-white p-3 sm:p-5">{body}</div>;
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
    <section {...resto} className={cn("min-w-0 rounded-xl border border-sage-200 bg-white p-4 sm:p-6", className)}>
      {title && <h2 className="mb-3 font-title text-lg font-semibold text-ink sm:mb-4">{title}</h2>}
      {children}
    </section>
  );
}

/**
 * Estado vazio (Prompt 48): uma frase do que acontece aqui e o PRÓXIMO PASSO (obrigatório). Sem ilustração genérica
 * de "nada aqui" — no máximo o ícone pequeno da área, em cinza. Fila do admin vazia usa <FilaVazia> (com a data da
 * última decisão).
 */
export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  action: React.ReactNode;
}) {
  return (
    <div data-testid="estado-vazio" className="rounded-xl border border-line bg-white p-6 sm:p-8">
      <div className="flex items-start gap-3">
        {Icon && (
          <span data-testid="estado-vazio-icone" className="mt-1 shrink-0 text-muted" aria-hidden>
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="font-title text-base font-semibold text-ink">{title}</h3>
          <p className="mt-1 max-w-md text-sm text-muted">{text}</p>
          <div className="mt-4" data-testid="estado-vazio-acao">
            {action}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Fila do admin vazia (Prompt 48): "Nada pendente." com a data da última decisão tomada nessa fila (quando houver).
 */
export function FilaVazia({ ultimaDecisao, texto }: { ultimaDecisao?: string | null; texto?: string }) {
  const quando = ultimaDecisao ? new Date(ultimaDecisao) : null;
  const data =
    quando && !Number.isNaN(quando.getTime())
      ? quando.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : null;
  return (
    <div data-testid="fila-vazia" className="rounded-xl border border-line bg-white p-6">
      <p className="font-title text-base font-semibold text-ink">Nada pendente.</p>
      <p className="mt-1 text-sm text-muted" data-testid="fila-vazia-ultima">
        {texto ?? (data ? `Última decisão em ${data} (horário de Brasília).` : "Nenhuma decisão registrada nesta fila ainda.")}
      </p>
    </div>
  );
}
