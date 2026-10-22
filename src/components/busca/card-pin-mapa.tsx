import Link from "next/link";
import { Bath, BedDouble, PawPrint, X, type LucideIcon } from "lucide-react";
import { ICONE_POR_CHAVE } from "@/lib/anuncio/comodidades-icones";
import type { Property } from "@/lib/types";
import { quartosTexto, banheirosTexto } from "@/lib/anuncio/plural";
import { precoDeBusca } from "@/lib/busca/painel-filtros";
import { AMENITY_KEY_BY_LABEL, AMENITY_LABEL } from "@/lib/amenities";
import { mesesDoCartao, rotuloPreco } from "@/lib/cartao-preco";
import { BrandImage } from "@/components/brand-image";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { ReadyToLiveBadge } from "@/components/ui/badge";

/** Comodidades com ícone no card do mapa (as mais procuradas por quem fica meses). */
const CHAVES_NO_CARD = ["internet_fibra", "home_office", "ar_condicionado", "maquina_lavar", "vaga_garagem", "piscina", "academia"];
const ICONES: [string, LucideIcon][] = CHAVES_NO_CARD.map((k) => [k, ICONE_POR_CHAVE[k]]);

const isPhoto = (s?: string) => typeof s === "string" && (/^https?:\/\//.test(s) || s.startsWith("/"));

/** Ícones de comodidade do imóvel (máx. 6), com o nome para leitor de tela. */
export function iconesComodidades(p: Pick<Property, "amenities" | "petsAllowed">): { chave: string; rotulo: string; Icone: LucideIcon }[] {
  const tem = new Set((p.amenities ?? []).map((a) => AMENITY_KEY_BY_LABEL[a] ?? a));
  const out = ICONES.filter(([k]) => tem.has(k)).map(([k, Icone]) => ({ chave: k, rotulo: AMENITY_LABEL[k] ?? k, Icone }));
  if (p.petsAllowed) out.push({ chave: "pet", rotulo: "Aceita pets", Icone: PawPrint });
  return out.slice(0, 6);
}

/**
 * Card que abre ANCORADO no pin ao clicar (ordem ca0e7dad, complemento): foto,
 * selo, título, cidade, disponibilidade, preço/mês, quartos/banheiros e ícones de
 * comodidades. Clicar no card abre o imóvel; o × fecha sem sair da busca.
 */
export function CardPinMapa({ property: p, onFechar }: { property: Property; onFechar: () => void }) {
  // Prompt 47: o mesmo rótulo de preço do cartão (função única).
  const preco = rotuloPreco({ mensal: precoDeBusca(p), meses: mesesDoCartao(undefined, p.minPeriodDays), disponivelEm: p.availableFrom });
  const icones = iconesComodidades(p);
  return (
    <div data-testid="card-pin-mapa" data-id={p.id} className="relative w-64 overflow-hidden rounded-xl bg-white font-sans shadow-flutuante">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onFechar();
        }}
        aria-label="Fechar"
        className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white text-ink hover:bg-surface-2"
      >
        <X className="h-4 w-4" />
      </button>
      <Link href={`/imoveis/${p.id}`} className="block text-ink no-underline">
        <div className="relative aspect-[16/10]">
          {isPhoto(p.photos[0]) ? (
            <BrandImage src={p.photos[0]} alt={p.title} rounded="rounded-none" treat={false} sizes="256px" className="h-full w-full" />
          ) : (
            <PhotoPlaceholder label={p.photos[0]} className="h-full w-full" />
          )}
          {p.readyToLiveBadge && (
            <div className="absolute left-2 top-2">
              <ReadyToLiveBadge size="sm" />
            </div>
          )}
        </div>
        <div className="space-y-2 p-3">
          <p className="line-clamp-1 text-sm font-semibold text-ink">{p.title}</p>
          <p className="truncate text-xs text-muted">
            {p.neighborhood}, {p.city}
          </p>
          {preco.disponivel && <p className="text-xs text-muted">{preco.disponivel}</p>}
          <p className="tabular-nums">
            <span className="font-title text-lg font-semibold text-forest">{preco.valor}</span>
            <span className="text-xs text-muted">/mês</span>
            {preco.estadia && <span className="block text-xs text-muted">{preco.estadia}</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-xs text-ink">
              <BedDouble className="h-3.5 w-3.5" aria-hidden /> {quartosTexto(p.bedrooms)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-xs text-ink">
              <Bath className="h-3.5 w-3.5" aria-hidden /> {banheirosTexto(p.bathrooms)}
            </span>
          </div>
          {icones.length > 0 && (
            <ul className="flex items-center gap-2 pt-1 text-muted" aria-label="Comodidades" data-testid="card-pin-comodidades">
              {icones.map(({ chave, rotulo, Icone }) => (
                <li key={chave} title={rotulo}>
                  <Icone className="h-4 w-4" aria-hidden />
                  <span className="sr-only">{rotulo}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Link>
    </div>
  );
}
