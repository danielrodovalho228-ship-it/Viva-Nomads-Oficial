import { BrandImage } from "@/components/brand-image";
import { cn } from "@/lib/utils";

/** Faixa de boas-vindas/onboarding do dashboard, com foto de fundo e overlay. */
export function DashboardBanner({
  image,
  alt,
  title,
  subtitle,
  action,
  className,
}: {
  image: string;
  alt: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      <BrandImage src={image} alt={alt} rounded="rounded-xl" treat={false} sizes="100vw" className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-night/65" />
      <div className="relative flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="max-w-lg">
          <h1 className="font-title text-xl font-semibold text-white sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-white/80">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
