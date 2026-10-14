import Link from "next/link";
import { BrandImage } from "@/components/brand-image";
import { ATALHOS_CATEGORIA } from "@/config/atalhos-home";

/** Atalhos por categoria da home (ordem bab1b2aa) — lista em config/atalhos-home.ts. */
export function AtalhosCategoria() {
  return (
    <section className="bg-surface py-10 sm:py-14" aria-labelledby="atalhos-titulo">
      <div className="container-page">
        <h2 id="atalhos-titulo" className="text-center font-title text-2xl font-bold text-ink sm:text-3xl">
          Encontre o imóvel do seu jeito
        </h2>
        <ul className="mx-auto mt-6 grid max-w-4xl grid-cols-2 gap-4 sm:mt-10 sm:grid-cols-4 sm:gap-8" data-testid="atalhos-categoria">
          {ATALHOS_CATEGORIA.map((a) => (
            <li key={a.href}>
              <Link href={a.href} className="group flex flex-col items-center gap-3 rounded-2xl text-center outline-none focus-visible:ring-2 focus-visible:ring-forest">
                <BrandImage
                  src={a.foto}
                  alt={a.alt}
                  sizes="(max-width: 640px) 45vw, 160px"
                  rounded="rounded-xl"
                  className="aspect-[25/24] w-full max-w-[10rem] transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <span className="font-title text-sm font-bold text-ink sm:text-base">{a.rotulo}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
