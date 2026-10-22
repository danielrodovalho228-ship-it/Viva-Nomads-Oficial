import Link from "next/link";
import { BadgeCheck, BadgePercent, PawPrint, Star } from "lucide-react";
import type { Property } from "@/lib/types";
import { numBR } from "@/lib/utils";
import { calcularTudoIncluido } from "@/lib/precos";
import { mesesDoCartao, rotuloPreco } from "@/lib/cartao-preco";
import { itensSintese } from "@/lib/cartao-sintese";
import { isExemplo } from "@/lib/demo-listing";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { FavoriteButton } from "@/components/favorite-button";
import { ROTULO_SELO_UNICO, seloDoCartao, type SeloUnico } from "@/lib/card-selos";
import { MarcaImovel } from "@/components/property/marca-imovel";
import { FotosCartao, SetasFotos } from "@/components/property/fotos-cartao";

const ehFoto = (src: unknown): src is string => typeof src === "string" && (/^https?:\/\//.test(src) || src.startsWith("/"));

export function PropertyCard({
  property,
  periodMonths,
}: {
  property: Property;
  /** Quando a busca tem período selecionado, mostra o total estimado do período. */
  periodMonths?: number;
}) {
  const fotos = property.photos.filter(ehFoto);
  const exemplo = isExemplo(property);
  // "Tudo incluído" pela FONTE ÚNICA (valor mensal + condomínio + consumo fixo) — o mesmo número da página
  // do imóvel e do pino do mapa. O total da estadia = total do mês × meses (da busca ou a estadia mínima).
  const inc = calcularTudoIncluido(property);
  // Prompt 47: preço com contexto pela função única (mensal · total do período · disponível a partir de).
  const preco = rotuloPreco({ mensal: inc.total, meses: mesesDoCartao(periodMonths, property.minPeriodDays), disponivelEm: property.availableFrom });
  const sintese = itensSintese(property);
  const selo = seloDoCartao({
    // Verificação do dono só quando o dado chega com o anúncio; exemplo nunca.
    verificado: !exemplo && property.owner?.verified === true,
    precoJusto: !!property.precoJusto,
    pets: !!property.petsAllowed,
  });

  return (
    // Prompt 40 + adendo + QA do Muse: cartão SEM caixa, borda ou sombra. Ordem CONGELADA: foto 4:3 (raio 12,
    // carrossel com pontos, coração no canto) → bairro + nota → título (até 2 linhas) → "R$ X/mês · R$ Y em
    // N meses" (N = 1: só "R$ X/mês") → quartos · banheiros · m² · mobiliado → "Disponível a partir de [data]".
    // No máximo 1 selo. "Ideal para" fica na página do imóvel.
    // O coração e as setas ficam FORA do <a> (botão dentro de link é HTML inválido): ordem 826719b1, D12.
    <div className="group relative h-full" data-testid="cartao-imovel">
    <Link
      href={`/imoveis/${property.id}`}
      className="flex h-full flex-col gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-4"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2" data-testid="cartao-foto">
        {fotos.length > 0 ? (
          <FotosCartao fotos={fotos} alt={property.title} />
        ) : (
          <PhotoPlaceholder label={property.photos[0]} className="h-full w-full" />
        )}
        {/* No máximo 1 selo (adendo do Prompt 40): Proprietário verificado → Preço justo → Aceita pets. */}
        <div className="absolute left-3 top-3 flex" data-testid="selos-foto">
          {selo && <Selo id={selo} />}
        </div>
        {/* Marca do usuário logado ("Visto" / "Você já contatou"): canto inferior esquerdo. */}
        <div className="absolute bottom-3 left-3">
          <MarcaImovel propertyId={property.id} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          {/* Bairro (com a cidade) + nota. Cartão 16/600. */}
          <h3 className="min-w-0 truncate font-title text-base font-semibold leading-snug text-ink" data-testid="cartao-local">
            {property.neighborhood}, {property.city}
          </h3>
          {exemplo ? (
            // Anúncio de exemplo: nunca mostra nota (seria fictícia) — e fica marcado.
            <span className="shrink-0 text-xs text-apoio">Anúncio de exemplo</span>
          ) : property.reviewCount > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-sm tabular-nums text-ink" data-testid="cartao-nota">
              <Star className="h-3.5 w-3.5 fill-ink text-ink" aria-hidden />
              {numBR(property.rating, 1)}
              <span className="text-apoio text-sm">({property.reviewCount})</span>
            </span>
          ) : (
            // Sem avaliação REAL no banco: nada de estrela inventada — texto honesto.
            <span className="shrink-0 text-xs text-apoio">Novo na plataforma</span>
          )}
        </div>

        <p className="line-clamp-2 text-sm text-muted" data-testid="cartao-titulo">
          {property.title}
        </p>

        {/* Total do mês (ordem 1a555bfa: valor mensal + condomínio + consumo fixo, o mesmo do pino do mapa)
            + total da estadia; o preço é o maior texto (18/600, verde). Rótulo em src/lib/cartao-preco.ts. */}
        <p className="tabular-nums" data-testid="cartao-total-mes">
          <span className="font-title text-lg font-semibold text-forest" data-testid="cartao-preco-mes">
            {preco.valor}
          </span>
          <span className="text-sm text-ink">/mês</span>
          {preco.estadia && (
            <span className="text-sm text-muted" data-testid="cartao-total-estadia">
              {" · "}
              {preco.estadia}
            </span>
          )}
        </p>

        {/* Linha-síntese: cada item só com o dado; a linha some se não houver nenhum (src/lib/cartao-sintese.ts). */}
        {sintese.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted" data-testid="cartao-sintese">
            {sintese.map((item, i) => (
              <span key={item.chave} className="inline-flex items-center gap-x-1">
                {i > 0 && <span aria-hidden>·</span>}
                <span className={item.chave === "area" ? "tabular-nums" : undefined} data-testid={item.chave === "quartos" ? "card-quartos" : undefined}>
                  {item.texto}
                </span>
              </span>
            ))}
            {property.petsAllowed && (
              <span className="ml-1 inline-flex items-center" title="Aceita pets">
                <PawPrint className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Aceita pets</span>
              </span>
            )}
          </p>
        )}

        {/* Data de available_from (a agenda de bloqueios não vem na lista: ver "funcional pendente" do PR). */}
        {preco.disponivel && (
          <p className="text-sm tabular-nums text-muted" data-testid="cartao-disponivel">
            {preco.disponivel}
          </p>
        )}
      </div>
    </Link>
    {fotos.length > 1 && <SetasFotos />}
    <div className="absolute right-3 top-3 z-10">
      <FavoriteButton propertyId={property.id} />
    </div>
    </div>
  );
}

/** Selo único sobre a foto: pill branca com ícone e nome, sem sombra. Selo 12/600. */
function Selo({ id }: { id: SeloUnico }) {
  const Icone = id === "verificado" ? BadgeCheck : id === "precoJusto" ? BadgePercent : PawPrint;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-semibold text-ink"
      data-testid={id === "precoJusto" ? "selo-preco-justo" : `selo-${id}`}
    >
      <Icone className="h-3.5 w-3.5" aria-hidden /> {ROTULO_SELO_UNICO[id]}
    </span>
  );
}
