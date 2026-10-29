"use client";

import type { ReactNode } from "react";
import { Eye, ImageIcon, MapPin } from "lucide-react";
import { propertyTypeLabel } from "@/lib/amenities";
import { linhaPrevia, localPrevia, tituloPrevia } from "@/lib/anuncio/assistente-telas";
import { SOMBRA_CARTAO_CADASTRO } from "@/lib/conta/visual-mockup";
import { cn } from "@/lib/utils";

/**
 * "Visualização do anúncio · Ao vivo" (todas as telas dos mockups cadastro-imovel-01..10, no computador): o cartão do
 * anúncio montando enquanto o dono preenche — foto principal, título (ou "Apartamento no Santa Mônica"), quartos e área,
 * os chips (tipo, mobiliado, pets) e o lugar. Sem foto ainda: o espaço dela, sem imagem de exemplo.
 */
export function PreviaAnuncio(p: {
  foto: string | null;
  titulo: string;
  tipo: string;
  quartos: number;
  areaM2: number;
  mobiliado: boolean;
  pets: boolean;
  bairro: string;
  cidade: string;
  uf: string;
  publicado: boolean;
  /** E242: o "Ver no tamanho real", embaixo da foto. */
  tamanhoReal?: ReactNode;
}) {
  const linha = linhaPrevia(p.quartos, p.areaM2);
  const local = localPrevia(p.bairro, p.cidade, p.uf);
  const chips = [p.tipo ? propertyTypeLabel(p.tipo) : null, p.mobiliado ? "Mobiliado" : null, p.pets ? "Pet-friendly" : null].filter(Boolean) as string[];
  return (
    <section className={cn("rounded-xl bg-white p-6", SOMBRA_CARTAO_CADASTRO)} aria-label="Visualização do anúncio" data-testid="previa-anuncio">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        Visualização do anúncio
        <span className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-1 text-xs font-semibold text-forest">
          <Eye className="h-3.5 w-3.5" aria-hidden /> Ao vivo
        </span>
      </p>
      <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-lg bg-surface-2">
        {p.foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto do próprio dono (URL do armazenamento ou blob local)
          <img src={p.foto} alt="Foto principal do anúncio" className="h-full w-full object-cover" data-testid="previa-foto" />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted" data-testid="previa-sem-foto">
            <ImageIcon className="h-8 w-8" aria-hidden />A foto principal aparece aqui
          </span>
        )}
      </div>
      {p.tamanhoReal}
      <p className="mt-4 font-title text-xl font-semibold text-ink" data-testid="previa-titulo">
        {tituloPrevia(p.titulo, p.tipo, p.bairro)}
      </p>
      {linha && (
        <p className="mt-1 text-sm text-muted" data-testid="previa-linha">
          {linha}
        </p>
      )}
      {chips.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" data-testid="previa-chips">
          {chips.map((c) => (
            <li key={c} className="rounded-full bg-sage-100 px-3 py-1 text-sm font-medium text-forest">
              {c}
            </li>
          ))}
        </ul>
      )}
      {local && (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink" data-testid="previa-local">
          <MapPin className="h-4 w-4 shrink-0 text-forest" aria-hidden /> {local}
        </p>
      )}
      {!p.publicado && (
        <p className="mt-4 flex flex-wrap gap-2 text-sm" data-testid="previa-estado">
          <span className="rounded-full bg-forest px-3 py-1 font-semibold text-white">Em edição</span>
          <span className="rounded-full border border-line px-3 py-1 text-muted">Rascunho</span>
        </p>
      )}
    </section>
  );
}
