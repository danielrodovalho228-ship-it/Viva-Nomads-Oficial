import Link from "next/link";
import { BedDouble, CarFront, Laptop, MapPin, PawPrint, Wallet, type LucideIcon } from "lucide-react";
import { ATALHOS_CATEGORIA } from "@/config/atalhos-home";
import { atalhosComContagem } from "@/lib/busca/atalhos-contagem";
import type { Property } from "@/lib/types";

const ICONES: Record<string, LucideIcon> = { Wallet, PawPrint, Laptop, BedDouble, MapPin, CarFront };

/**
 * Atalhos por categoria da home (ordens bab1b2aa e a875278a) — lista em config/atalhos-home.ts.
 * Mostra a contagem real de imóveis de cada atalho e esconde o que der 0.
 */
export function AtalhosCategoria({ imoveis }: { imoveis: Property[] }) {
  const atalhos = atalhosComContagem(ATALHOS_CATEGORIA, imoveis);
  if (atalhos.length === 0) return null;
  return (
    <section className="bg-surface py-10 sm:py-14" aria-labelledby="atalhos-titulo">
      <div className="container-page">
        <h2 id="atalhos-titulo" className="text-center font-title text-2xl font-bold text-ink sm:text-3xl">
          Encontre o imóvel do seu jeito
        </h2>
        <ul className="mx-auto mt-6 grid max-w-5xl grid-cols-2 gap-4 sm:mt-10 sm:grid-cols-3 lg:grid-cols-6 sm:gap-6" data-testid="atalhos-categoria">
          {atalhos.map((a) => (
            <li key={a.href}>
              <Link href={a.href} className="group flex flex-col items-center gap-3 rounded-2xl text-center outline-none focus-visible:ring-2 focus-visible:ring-forest">
                <span className="flex aspect-square w-20 items-center justify-center rounded-2xl bg-forest/10 text-forest transition-colors group-hover:bg-forest/15 sm:w-24">
                  {(() => {
                    const Icone = ICONES[a.icone] ?? MapPin;
                    return <Icone aria-hidden className="h-9 w-9 sm:h-10 sm:w-10" />;
                  })()}
                </span>
                <span className="font-title text-sm font-bold text-ink sm:text-base">{a.rotulo}</span>
                <span className="-mt-2 text-xs text-muted" data-testid="atalho-total">
                  {a.total} {a.total === 1 ? "imóvel" : "imóveis"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
