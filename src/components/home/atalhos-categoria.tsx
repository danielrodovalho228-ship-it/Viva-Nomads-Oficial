import Image from "next/image";
import Link from "next/link";
import { BedDouble, CarFront, Laptop, MapPin, PawPrint, Wallet, type LucideIcon } from "lucide-react";
import { ATALHOS_CATEGORIA } from "@/config/atalhos-home";
import { atalhosComContagem } from "@/lib/busca/atalhos-contagem";
import { comTotalMes } from "@/lib/precos";
import type { Property } from "@/lib/types";
import { BRAND_BLUR } from "@/lib/media";

const ICONES: Record<string, LucideIcon> = { Wallet, PawPrint, Laptop, BedDouble, MapPin, CarFront };

/**
 * Atalhos por categoria da home (ordens bab1b2aa e a875278a) — lista em config/atalhos-home.ts.
 * Mostra a contagem real de imóveis de cada atalho e esconde o que der 0.
 * Cartão com foto (ordens 0f93aa8c e 5ade9aaa): proporção fixa 4:3, ícone da categoria
 * sobre a foto, título com no máximo 2 linhas e contagem — todos com a mesma altura.
 */
export function AtalhosCategoria({ imoveis }: { imoveis: Property[] }) {
  // Conta pelo TOTAL do mês (o do cartão), como a /buscar filtra.
  const atalhos = atalhosComContagem(ATALHOS_CATEGORIA, imoveis.map((p) => comTotalMes(p)));
  if (atalhos.length === 0) return null;
  return (
    <section className="bg-surface py-10 sm:py-14" aria-labelledby="atalhos-titulo">
      <div className="container-page">
        <h2 id="atalhos-titulo" className="text-center font-title text-xl font-semibold text-ink">
          Encontre o imóvel do seu jeito
        </h2>
        <ul className="mx-auto mt-6 grid max-w-6xl auto-rows-fr grid-cols-2 gap-x-4 gap-y-6 sm:mt-10 sm:gap-x-6 lg:grid-cols-6" data-testid="atalhos-categoria">
          {atalhos.map((a) => {
            const Icone = ICONES[a.icone] ?? MapPin;
            return (
              <li key={a.href}>
                <Link
                  href={a.href}
                  data-testid="atalho-cartao"
                  className="group flex h-full flex-col gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
                >
                  {/* Sem caixa: foto 4:3 com raio de 12 px e o texto solto (mesmo padrão do cartão de anúncio). */}
                  <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
                    <Image
                      src={a.foto}
                      alt={a.alt}
                      fill
                      sizes="(min-width: 1024px) 200px, 50vw"
                      placeholder="blur"
                      blurDataURL={BRAND_BLUR}
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <span className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white text-ink">
                      <Icone aria-hidden className="h-4 w-4" />
                    </span>
                  </span>
                  <span className="flex flex-1 flex-col gap-1">
                    <span className="line-clamp-2 font-title text-[15px] font-semibold leading-snug text-ink sm:text-base">{a.rotulo}</span>
                    <span className="mt-auto text-xs tabular-nums text-apoio" data-testid="atalho-total">
                      {a.total} {a.total === 1 ? "imóvel" : "imóveis"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
