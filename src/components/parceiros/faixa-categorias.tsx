import Image from "next/image";
import Link from "next/link";
import { CATEGORIAS_CATALOGO } from "@/lib/parceiros/regras";
import { fotoDaCategoria } from "@/config/fotos-categorias-parceiro";
import { BRAND_BLUR } from "@/lib/media";
import { cn } from "@/lib/utils";

/**
 * E277 (mockup aprovado em 30/10): a faixa das categorias com foto na busca de parceiros. Cada cartão é o mesmo
 * filtro "Categoria" do formulário, já aplicado (mantém cidade/UF e o imóvel de onde a pessoa veio). A categoria da
 * busca aparece marcada. Rola para o lado no celular; no computador, 6 numa linha.
 */
export function FaixaCategorias({ atual, consulta }: { atual: string; consulta: Record<string, string> }) {
  const lista = CATEGORIAS_CATALOGO.filter((c) => c.valor !== "outro" && fotoDaCategoria(c.valor));
  return (
    <nav aria-label="Categorias de parceiros" className="mt-8" data-testid="faixa-categorias">
      <h2 className="text-base font-semibold text-ink">{atual ? "Outras categorias" : "Categorias"}</h2>
      <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
        {lista.map((c) => {
          const foto = fotoDaCategoria(c.valor)!;
          const ativa = c.valor === atual;
          const href = `/parceiros/buscar?${new URLSearchParams({ ...consulta, categoria: c.valor }).toString()}`;
          return (
            <li key={c.valor} className="w-36 shrink-0 snap-start sm:w-auto">
              <Link
                href={href}
                aria-current={ativa ? "page" : undefined}
                className={cn(
                  "group flex h-full flex-col overflow-hidden rounded-xl border bg-white outline-none transition-colors focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2",
                  ativa ? "border-forest ring-1 ring-forest" : "border-line hover:border-forest",
                )}
                data-testid={`faixa-categoria-${c.valor}`}
              >
                <span className="relative block aspect-[16/10] overflow-hidden bg-surface-2">
                  <Image src={foto.src} alt={foto.alt} fill sizes="(min-width: 1024px) 180px, (min-width: 640px) 30vw, 144px" placeholder="blur" blurDataURL={BRAND_BLUR} className="object-cover transition-transform duration-500 group-hover:scale-105" />
                </span>
                <span className={cn("px-3 py-2 text-sm font-semibold", ativa ? "text-forest" : "text-ink")}>{c.rotulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
