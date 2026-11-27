import { BadgeCheck, Handshake, PawPrint } from "lucide-react";
import { IconePrecoJusto } from "@/components/ui/icone-preco-justo";
import { pilulasDoCartao, type SelosDoCartao, type SimboloFoto } from "@/lib/cartao-selos-foto";
import { COR_NIVEL } from "@/components/property/selos-foto";
import { cn } from "@/lib/utils";

const ICONE: Record<SimboloFoto, React.ComponentType<{ className?: string }>> = {
  verificado: BadgeCheck,
  precoJusto: IconePrecoJusto,
  pets: PawPrint,
  negocia: Handshake,
};
const TESTID: Record<SimboloFoto, string> = { verificado: "selo-verificado", precoJusto: "selo-preco-justo", pets: "selo-pets", negocia: "selo-negocia" };

/**
 * E626: na página do imóvel os selos que o cartão mostra só em símbolo aparecem COMPLETOS — símbolo + texto.
 * E924: a fileira do topo tem a MESMA composição e ordem do cartão do mesmo anúncio, porque recebe o resultado da mesma função
 * (selosDaFoto): primeiro o nível, em pílula própria, com a palavra e a cor do nível; depois os outros selos juntos, na ordem
 * verificado, preço justo, pets, negociação. Antes o topo não tinha o nível e, sem os outros selos, não tinha fileira nenhuma:
 * de uma página para outra parecia não haver padrão. O bloco "Nível" (mais abaixo, com o critério) não muda. Sem nenhum selo,
 * nada é desenhado.
 */
export function SelosAnuncio({ selos }: { selos: SelosDoCartao }) {
  if (pilulasDoCartao(selos) === 0) return null;
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Selos do anúncio" data-testid="selos-anuncio">
      {selos.nivel && (
        <li className={cn("inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold", COR_NIVEL[selos.nivel.id])} data-testid="selo-nivel" data-selo="nivel" data-nivel={selos.nivel.id}>
          {selos.nivel.rotulo}
        </li>
      )}
      {selos.simbolos.map((s) => {
        const Icone = ICONE[s.id];
        return (
          <li key={s.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2 py-1 text-xs font-semibold text-ink" data-testid={TESTID[s.id]} data-selo={s.id}>
            <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {s.rotulo}
          </li>
        );
      })}
    </ul>
  );
}
