import { cn } from "@/lib/utils";
import { HardHat } from "lucide-react";

/**
 * Placeholder padrão "Em construção" — SEMPRE dentro da casca do dashboard
 * (regra 0.5). Toda rota nova do menu que ainda não tem a tela pronta renderiza
 * este componente em vez de 404, página em branco ou rota pública. Assim o
 * usuário nunca "cai fora" do painel.
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
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-title text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-sage-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <Icon className="h-5 w-5 text-sage" />
      </div>
      <p className="mt-2 font-title text-3xl font-bold text-forest">{value}</p>
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-sage-200 bg-white p-6", className)}>
      {title && <h2 className="mb-4 font-title text-lg font-bold text-ink">{title}</h2>}
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
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
      {illustration ? (
        <div className="flex justify-center">{illustration}</div>
      ) : (
        Icon && <Icon className="mx-auto h-10 w-10 text-blue-500" />
      )}
      <h3 className="mt-4 font-title text-lg font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
