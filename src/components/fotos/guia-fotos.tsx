"use client";

import { useState } from "react";
import { Check, ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DICAS_FOTO, PARES_EXEMPLO, ROTA_FOTOGRAFOS } from "@/lib/fotos/guia";

function Exemplo({ src, ambiente, bom }: { src: string; ambiente: string; bom: boolean }) {
  const [falhou, setFalhou] = useState(false);
  const Icone = bom ? Check : X;
  return (
    <figure className={cn("overflow-hidden rounded-xl border-2", bom ? "border-green-600" : "border-red-600")}>
      <div className="relative aspect-[4/3] bg-sage-100">
        {falhou ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-sage">
            <ImageIcon className="h-6 w-6" aria-hidden />
            <span className="px-3 text-center text-xs">Exemplo em breve</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- arquivo estático opcional; onError mostra o placeholder
          <img
            src={src}
            alt={`${ambiente}: exemplo ${bom ? "bom, organizado e iluminado" : "ruim, bagunçado e escuro"}`}
            width={1200}
            height={896}
            loading="lazy"
            onError={() => setFalhou(true)}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <figcaption className={cn("flex items-center gap-2 px-3 py-2 text-sm font-semibold", bom ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>
        <Icone className="h-4 w-4" aria-hidden />
        {bom ? "Assim" : "Evite"}
      </figcaption>
    </figure>
  );
}

/**
 * Guia "Como tirar boas fotos": pares Evite × Assim (empilhados no celular) e dicas curtas.
 * nivelTitulo (02/11): na página /guia-fotos os ambientes ficam sob um h2 (h3); no cadastro, direto sob o h1 da etapa — lá
 * entram como h2, para a hierarquia de títulos não pular um nível.
 */
export function GuiaFotos({ comCta = true, nivelTitulo = 3 }: { comCta?: boolean; nivelTitulo?: 2 | 3 }) {
  const Titulo = nivelTitulo === 2 ? "h2" : "h3";
  return (
    <div className="space-y-6">
      {PARES_EXEMPLO.map((p) => (
        <section key={p.ambiente} aria-labelledby={`guia-${p.ambiente}`}>
          <Titulo id={`guia-${p.ambiente}`} className="mb-2 font-display text-lg font-semibold text-ink">{p.ambiente}</Titulo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Exemplo src={p.ruim} ambiente={p.ambiente} bom={false} />
            <Exemplo src={p.bom} ambiente={p.ambiente} bom />
          </div>
        </section>
      ))}
      <section aria-labelledby="guia-dicas">
        <Titulo id="guia-dicas" className="mb-2 font-display text-lg font-semibold text-ink">Dicas rápidas</Titulo>
        <ol className="list-decimal space-y-2 pl-4 text-sm text-ink/80">
          {DICAS_FOTO.map((d) => <li key={d}>{d}</li>)}
        </ol>
      </section>
      {comCta && (
        <p className="text-sm">
          Prefere um profissional?{" "}
          <a href={ROTA_FOTOGRAFOS} className="font-medium text-forest underline">Ver fotógrafos parceiros</a>
        </p>
      )}
    </div>
  );
}
