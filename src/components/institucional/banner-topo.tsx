import Image from "next/image";
import { BRAND_BLUR } from "@/lib/media";
import { cn } from "@/lib/utils";

/**
 * Banner de topo das páginas institucionais (ordem 5a4b9146): LARGURA TOTAL,
 * foto de fundo, degradê escuro para o texto branco ficar sempre legível,
 * título (h1), subtítulo e ações. Um só padrão para todas as páginas.
 */
export function BannerTopo({
  foto,
  alt,
  eyebrow,
  titulo,
  subtitulo,
  children,
  alinhamento = "esquerda",
  className,
  posicaoFoto,
}: {
  foto: string;
  alt: string;
  eyebrow?: string;
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  /** Botões/links de ação. */
  children?: React.ReactNode;
  alinhamento?: "esquerda" | "centro";
  className?: string;
  /** Enquadramento da foto (object-position), ex.: "50% 25%" para não cortar cabeças. */
  posicaoFoto?: string;
}) {
  const centro = alinhamento === "centro";
  return (
    <section data-testid="banner-topo" className={cn("relative isolate overflow-hidden bg-night text-white", className)}>
      <Image src={foto} alt={alt} fill priority sizes="100vw" placeholder="blur" blurDataURL={BRAND_BLUR} className="-z-10 object-cover" style={posicaoFoto ? { objectPosition: posicaoFoto } : undefined} />
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10",
          centro ? "bg-night/60" : "bg-gradient-to-r from-night/85 via-night/60 to-night/20"
        )}
      />
      <div className={cn("container-page flex min-h-[22rem] flex-col justify-center py-16 md:min-h-[26rem] md:py-20", centro && "items-center text-center")}>
        {eyebrow && <p className="text-sm font-semibold uppercase tracking-[0.14em] text-green-300">{eyebrow}</p>}
        <h1 className={cn("mt-3 max-w-3xl font-title text-4xl font-bold leading-tight md:text-5xl", centro && "mx-auto")}>{titulo}</h1>
        {subtitulo && <div className={cn("mt-5 max-w-2xl text-lg text-white/85", centro && "mx-auto")}>{subtitulo}</div>}
        {children && <div className={cn("mt-8 flex flex-wrap gap-3", centro && "justify-center")}>{children}</div>}
      </div>
    </section>
  );
}
