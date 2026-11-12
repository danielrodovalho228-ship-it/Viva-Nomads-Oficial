import Link from "next/link";
import { Star } from "lucide-react";
import type { Property } from "@/lib/types";
import { numBR } from "@/lib/utils";
import { calcularTudoIncluido } from "@/lib/precos";
import { mesesDoCartao, resumoEmMeses, ROTULO_TOTAL_MES, rotuloPreco } from "@/lib/cartao-preco";
import { estadiaNoCartao } from "@/lib/cartao-estadia";
import { itensSintese } from "@/lib/cartao-sintese";
import { isExemplo } from "@/lib/demo-listing";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { FavoriteButton } from "@/components/favorite-button";
import { selosDaFoto } from "@/lib/cartao-selos-foto";
import { SelosFoto } from "@/components/property/selos-foto";
import { MarcaImovel } from "@/components/property/marca-imovel";
import { FotosCartao, SetasFotos } from "@/components/property/fotos-cartao";
import { linhaLocalizacao } from "@/lib/localizacao";

const ehFoto = (src: unknown): src is string => typeof src === "string" && (/^https?:\/\//.test(src) || src.startsWith("/"));

/** E454: quantos cartões formam a primeira fileira (4 colunas no computador; 2 no celular): as fotos deles carregam com prioridade. */
export const PRIMEIRA_FILEIRA = 4;

export function PropertyCard({
  property,
  periodMonths,
  prioridade = false,
}: {
  property: Property;
  /** Quando a busca tem período selecionado, mostra o total estimado do período. */
  periodMonths?: number;
  /** E454: cartão da primeira fileira: a foto principal carrega já e com prioridade alta (sem retângulo cinza na primeira pintura). */
  prioridade?: boolean;
}) {
  const fotos = property.photos.filter(ehFoto);
  const exemplo = isExemplo(property);
  // "Tudo incluído" pela FONTE ÚNICA (valor mensal + condomínio + consumo fixo) — o mesmo número da página
  // do imóvel e do pino do mapa. O total da estadia = total do mês × meses (da busca ou a estadia mínima).
  const inc = calcularTudoIncluido(property);
  // Prompt 47: preço com contexto pela função única (mensal · total do período · disponível a partir de).
  const preco = rotuloPreco({ mensal: inc.total, meses: mesesDoCartao(periodMonths, property.minPeriodDays), disponivelEm: property.availableFrom });
  // E756: o total da estadia é o MESMO da página do imóvel (mensalidades + limpezas de preparação e de saída), e o cartão diz o que inclui.
  const estadiaCartao = estadiaNoCartao(property, preco.meses);
  const sintese = itensSintese(property);
  // E416 (05/11): o nível virou selo da foto — sai da linha-síntese (nada repetido).
  const linhaSintese = sintese.filter((i) => i.chave !== "nivel");
  // E416 (05/11): todos os selos do imóvel, empilhados sobre a foto (antes: no máximo 1, e nenhum de nível).
  const selos = selosDaFoto({
    // Verificação do dono só quando o dado chega com o anúncio; exemplo nunca.
    verificado: !exemplo && property.owner?.verified === true,
    precoJusto: !!property.precoJusto,
    pets: !!property.petsAllowed,
    nivel: property.nivel,
    nivelVistoriado: property.nivelVistoriado,
    negocia: !!property.negociacao?.aceita,
  });

  return (
    // Prompt 40 + adendo + QA do Muse: cartão SEM caixa, borda ou sombra. Ordem CONGELADA: foto 4:3 (raio 12,
    // carrossel com pontos, coração no canto) → bairro + nota → título (até 2 linhas) → "R$ X/mês · R$ Y em
    // N meses" (N = 1: só "R$ X/mês") → quartos · banheiros · m² · mobiliado → "Disponível a partir de [data]".
    // Selos empilhados sobre a foto (E416). "Ideal para" fica na página do imóvel.
    // O coração e as setas ficam FORA do <a> (botão dentro de link é HTML inválido): ordem 826719b1, D12.
    <div className="group relative h-full" data-testid="cartao-imovel">
    <Link
      href={`/imoveis/${property.id}`}
      className="flex h-full flex-col gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-4"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2" data-testid="cartao-foto">
        {fotos.length > 0 ? (
          <FotosCartao fotos={fotos} alt={property.title} prioridade={prioridade} />
        ) : (
          <PhotoPlaceholder label={property.photos[0]} className="h-full w-full" />
        )}
        {/* E416: todos os selos, em fileira no canto superior esquerdo (quebra linha; nunca sobre o coração). */}
        <SelosFoto selos={selos} />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        {/* Varredura visual 31/10: o selo ao lado do bairro ("Anúncio de exemplo") espremia o bairro a "San…" no cartão
            de 2 colunas do celular. Com flex-wrap, o selo desce para a linha de baixo quando os dois não cabem, e o
            bairro só trunca se for maior que a linha inteira. */}
        <div className="flex flex-wrap items-start justify-between gap-x-2" data-testid="cartao-local-linha">
          {/* Bairro (com a cidade) + nota. Cartão 16/600. */}
          <h3 className="min-w-0 max-w-full line-clamp-2 font-title text-base font-semibold leading-snug text-ink" data-testid="cartao-local">
            {linhaLocalizacao(property.neighborhood, property.city, property.state)}
          </h3>
          {exemplo ? null : property.reviewCount > 0 ? (
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

        {/* E726: o selo do exemplo tem UMA posição só — sempre na linha de baixo, à esquerda, em todos os cartões (antes ia à direita ou
            quebrava para baixo conforme a largura do cartão e o nome do bairro). Exemplo nunca mostra nota (seria fictícia). */}
        {exemplo && (
          <span className="text-xs leading-6 text-apoio" data-testid="cartao-selo-exemplo">
            Anúncio de exemplo
          </span>
        )}

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
          {/* E356: todo cartão mostra o total da estadia (com 1 mês, "R$ X em 1 mês"): comparação igual entre vizinhos. */}
          <span className="text-sm text-muted" data-testid="cartao-total-estadia">
            {" · "}
            {estadiaCartao?.texto ?? resumoEmMeses(preco.total, preco.meses)}
          </span>
        </p>
        {/* E356: diz o que é o preço grande (o total do mês, com condomínio e consumo fixo). */}
        <p className="text-xs text-apoio" data-testid="cartao-total-rotulo">
          {ROTULO_TOTAL_MES}
        </p>
        {estadiaCartao?.composicao && (
          <p className="text-xs text-apoio" data-testid="cartao-total-composicao">
            Total da estadia: {estadiaCartao.composicao}
          </p>
        )}

        {/* Linha-síntese: cada item só com o dado; a linha some se não houver nenhum (src/lib/cartao-sintese.ts). */}
        {linhaSintese.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted" data-testid="cartao-sintese">
            {linhaSintese.map((item, i) => (
              <span key={item.chave} className="inline-flex items-center gap-x-1">
                {i > 0 && <span aria-hidden>·</span>}
                <span
                  className={item.chave === "area" ? "tabular-nums" : undefined}
                  data-testid={item.chave === "quartos" ? "card-quartos" : undefined}
                >
                  {item.texto}
                </span>
              </span>
            ))}
          </p>
        )}

        {/* Data de available_from (a agenda de bloqueios não vem na lista: ver "funcional pendente" do PR). */}
        {preco.disponivel && (
          <p className="text-sm tabular-nums text-muted" data-testid="cartao-disponivel">
            {preco.disponivel}
          </p>
        )}

        {/* E643: estado do usuário logado ("Visto" / "Você já contatou") no texto do cartão, fora da foto (que guarda só as 2 pílulas do E626). */}
        <MarcaImovel propertyId={property.id} />

        {/* E439 → E416: o "Aceita negociação" virou selo da foto (properties.negociacao, o mesmo dado do anúncio). */}
      </div>
    </Link>
    {fotos.length > 1 && <SetasFotos />}
    <div className="absolute right-3 top-3 z-10">
      <FavoriteButton propertyId={property.id} />
    </div>
    </div>
  );
}
