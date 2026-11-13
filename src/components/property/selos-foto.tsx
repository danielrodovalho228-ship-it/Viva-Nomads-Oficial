import { BadgeCheck, Handshake, PawPrint } from "lucide-react";
import { IconePrecoJusto } from "@/components/ui/icone-preco-justo";
import { pilulasDoCartao, type SelosDoCartao, type SimboloFoto } from "@/lib/cartao-selos-foto";
import { PilulaNivel } from "@/components/niveis/pilula-nivel";

const ICONE: Record<SimboloFoto, React.ComponentType<{ className?: string }>> = {
  verificado: BadgeCheck,
  precoJusto: IconePrecoJusto,
  pets: PawPrint,
  negocia: Handshake,
};

// Os test ids de antes seguem valendo (selo-preco-justo, selo-pets, selo-verificado, cartao-negocia; card-nivel é a pílula do nível).
const TESTID: Record<SimboloFoto, string> = {
  verificado: "selo-verificado",
  precoJusto: "selo-preco-justo",
  pets: "selo-pets",
  negocia: "cartao-negocia",
};


/**
 * E626 (06/11): no máximo 2 pílulas no canto superior esquerdo da foto. Pílula 1: o nível em palavra, com a cor do nível.
 * Pílula 2: branca, só símbolos (verificado, preço justo, pets, negociação), cada um com aria-label e title com o texto
 * completo — o leitor de tela lê os 4 nomes. O coração (canto direito) mantém o canto: um espaçador flutuante do tamanho
 * dele reserva o lugar, e o que não couber na 1ª linha desce para a de baixo, que usa a largura toda. Sem selo, nada.
 */
export function SelosFoto({ selos, semCoracao = false }: { selos: SelosDoCartao; /** Meus anúncios: sem o coração no canto, a fileira vai até a borda. */ semCoracao?: boolean }) {
  if (pilulasDoCartao(selos) === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 @container" data-testid="selos-foto" data-pilulas={pilulasDoCartao(selos)}>
      {!semCoracao && <span aria-hidden className="float-right h-11 w-12" data-testid="selos-foto-canto-coracao" />}
      {selos.nivel && (
        // E828: a mesma pílula da página do anúncio e da home (componente único).
        <PilulaNivel nivel={selos.nivel.id} className="mb-1 mr-1 @[16rem]:text-xs @[16rem]:leading-4" />
      )}
      {selos.simbolos.length > 0 && (
        <span role="group" aria-label="Selos do anúncio" className="mb-1 mr-1 inline-flex items-center gap-2 rounded-full border border-transparent bg-white px-2 py-1 align-top text-ink" data-testid="selos-simbolos">
          {selos.simbolos.map((s) => {
            const Icone = ICONE[s.id];
            return (
              <span key={s.id} role="img" aria-label={s.rotulo} title={s.rotulo} className="pointer-events-auto inline-flex" data-testid={TESTID[s.id]} data-selo={s.id}>
                <Icone className="h-4 w-4" />
              </span>
            );
          })}
        </span>
      )}
    </div>
  );
}
