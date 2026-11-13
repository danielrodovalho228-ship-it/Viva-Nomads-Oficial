import { BadgeCheck, Handshake, PawPrint } from "lucide-react";
import { IconePrecoJusto } from "@/components/ui/icone-preco-justo";
import {
  CRITERIO_SIMBOLO,
  ORDEM_SIMBOLOS,
  ROTULO_SIMBOLO,
  type SimboloFoto,
} from "@/lib/cartao-selos-foto";

const ICONE: Record<
  SimboloFoto,
  React.ComponentType<{ className?: string }>
> = {
  verificado: BadgeCheck,
  precoJusto: IconePrecoJusto,
  pets: PawPrint,
  negocia: Handshake,
};
const TESTID: Record<SimboloFoto, string> = {
  verificado: "selo-verificado",
  precoJusto: "selo-preco-justo",
  pets: "selo-pets",
  negocia: "selo-negocia",
};

/**
 * E626: na página do imóvel os selos que o cartão mostra só em símbolo aparecem COMPLETOS — símbolo + texto, na mesma
 * ordem do cartão (verificado, preço justo, pets, negociação). O bloco do nível não muda. Sem nenhum, nada é desenhado.
 */
export function SelosAnuncio({
  tem,
}: {
  tem: Partial<Record<SimboloFoto, boolean>>;
}) {
  const itens = ORDEM_SIMBOLOS.filter((id) => tem[id]);
  if (itens.length === 0) return null;
  return (
    <div>
      <ul
        className="flex flex-wrap gap-2"
        aria-label="Selos do anúncio"
        data-testid="selos-anuncio"
      >
        {itens.map((id) => {
          const Icone = ICONE[id];
          return (
            <li
              key={id}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2 py-1 text-xs font-semibold text-ink"
              data-testid={TESTID[id]}
              data-selo={id}
            >
              <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {ROTULO_SIMBOLO[id]}
            </li>
          );
        })}
      </ul>
      {/* E811: o critério de cada selo, visível (nenhum selo sem regra dita). */}
      <ul
        className="mt-2 space-y-1 text-xs text-muted"
        data-testid="selos-criterios"
      >
        {itens.map((id) => (
          <li key={id} data-criterio={id}>
            <span className="font-semibold text-ink">
              {ROTULO_SIMBOLO[id]}:
            </span>{" "}
            {CRITERIO_SIMBOLO[id]}.
          </li>
        ))}
      </ul>
    </div>
  );
}
