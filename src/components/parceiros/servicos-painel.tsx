import Image from "next/image";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { CATEGORIAS_CATALOGO } from "@/lib/parceiros/regras";
import { fotoDaCategoria } from "@/config/fotos-categorias-parceiro";
import { BRAND_BLUR } from "@/lib/media";

/**
 * Prompt 31a: seção "Serviços" dos painéis do inquilino e do dono — a busca de parceiros com a cidade preenchida.
 * E276: cada serviço é um cartão com a foto da categoria (4:3, todas do mesmo tamanho) e o nome embaixo; grade par
 * (2 colunas no celular, 3 no computador). O destino de cada cartão não mudou.
 */
export function ServicosPainel({ cidade }: { cidade?: string | null }) {
  const q = (categoria: string) => `/parceiros/buscar?${new URLSearchParams({ categoria, ...(cidade ? { cidade } : {}) }).toString()}`;
  const lista = CATEGORIAS_CATALOGO.filter((c) => c.valor !== "outro");
  return (
    <Panel title="Serviços" className="mt-6" data-testid="painel-servicos-parceiros">
      <p className="flex items-center gap-2 text-sm text-muted">
        <Wrench className="h-4 w-4 shrink-0" aria-hidden /> Parceiros aprovados pela Viva{cidade ? ` em ${cidade}` : ""}. Você combina tudo pelas mensagens da Viva.
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 sm:gap-x-4" data-testid="servicos-grade">
        {lista.map((c) => {
          const foto = fotoDaCategoria(c.valor);
          return (
            <li key={c.valor}>
              <Link
                href={q(c.valor)}
                className="group flex h-full flex-col gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
                data-testid={`servicos-${c.valor}`}
              >
                <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-surface-2" data-testid="servicos-foto">
                  {foto && (
                    <Image
                      src={foto.src}
                      alt={foto.alt}
                      fill
                      sizes="(min-width: 640px) 220px, 45vw"
                      placeholder="blur"
                      blurDataURL={BRAND_BLUR}
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                </span>
                <span className="text-sm font-semibold text-ink group-hover:text-forest">{c.rotulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
