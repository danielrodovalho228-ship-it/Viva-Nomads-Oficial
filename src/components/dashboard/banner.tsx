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
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      <BrandImage src={image} alt={alt} rounded="rounded-2xl" treat={false} sizes="100vw" className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-gradient-to-r from-night/85 via-night/60 to-night/20" />
      <div className="relative flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="max-w-lg">
          <h2 className="font-title text-2xl font-extrabold text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-white/80">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
