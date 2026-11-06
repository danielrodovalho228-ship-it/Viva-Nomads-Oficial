import { Award, BadgeCheck, BadgePercent, Handshake, PawPrint } from "lucide-react";
import type { SeloFoto } from "@/lib/cartao-selos-foto";

const ICONE: Record<SeloFoto, React.ComponentType<{ className?: string }>> = {
  verificado: BadgeCheck,
  precoJusto: BadgePercent,
  pets: PawPrint,
  nivel: Award,
  negocia: Handshake,
};

// Os test ids de antes continuam valendo (selo-preco-justo, selo-pets, selo-verificado; card-nivel e cartao-negocia, que
// eram texto do cartão e viraram selo).
const TESTID: Record<SeloFoto, string> = {
  verificado: "selo-verificado",
  precoJusto: "selo-preco-justo",
  pets: "selo-pets",
  nivel: "card-nivel",
  negocia: "cartao-negocia",
};

/**
 * E416 (05/11): os selos do cartão empilhados em fileira no canto superior esquerdo da foto, cada um com ícone + texto
 * (pill branca, sem sombra). A fileira quebra linha quando não cabe; só a 1ª linha divide a altura com o coração (canto
 * direito) — um espaçador flutuante do tamanho dele reserva o canto, e as linhas de baixo usam a largura toda da foto.
 * Em cartão estreito (fileira < 16rem: celular de 2 colunas, busca ao lado do mapa) o selo fica mais compacto, para não
 * cobrir a foto de forma desproporcional. Sem selo, nada é desenhado.
 */
export function SelosFoto({ selos, semCoracao = false }: { selos: { id: SeloFoto; rotulo: string }[]; /** Meus anúncios: sem o coração no canto, a fileira vai até a borda. */ semCoracao?: boolean }) {
  if (selos.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 @container" data-testid="selos-foto">
      {!semCoracao && <span aria-hidden className="float-right h-11 w-12" data-testid="selos-foto-canto-coracao" />}
      {selos.map((s) => {
        const Icone = ICONE[s.id];
        return (
          <span
            key={s.id}
            className="mb-1 mr-1 inline-flex max-w-full items-center gap-1 rounded-full bg-white px-1 py-1 align-top text-[11px] font-semibold leading-3 text-ink @[16rem]:px-2 @[16rem]:text-xs @[16rem]:leading-4"
            data-testid={TESTID[s.id]}
            data-selo={s.id}
          >
            <Icone className="h-3 w-3 shrink-0 @[16rem]:h-3.5 @[16rem]:w-3.5" aria-hidden />
            {/* Cartão estreito: o nível sem o "· vistoriado" (fica no title e volta a partir de 16rem). */}
            <span className="truncate" title={s.rotulo}>
              {s.rotulo.split(" · ")[0]}
              {s.rotulo.includes(" · ") && <span className="hidden @[16rem]:inline"> · {s.rotulo.split(" · ").slice(1).join(" · ")}</span>}
            </span>
          </span>
        );
      })}
    </div>
  );
}
