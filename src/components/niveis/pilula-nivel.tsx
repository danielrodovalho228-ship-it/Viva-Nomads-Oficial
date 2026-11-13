import { ROTULO_NIVEL, type Nivel } from "@/config/niveis";
import { tituloNivel } from "@/lib/niveis/exibicao";
import { cn } from "@/lib/utils";

/** Cor da pílula do nível (estudo E626): Essencial branco com borda cinza, Conforto verde-marca, Premium preto-marca. */
export const COR_NIVEL: Record<Nivel, string> = {
  essencial: "border-[#b8b8b8] bg-white text-ink",
  conforto: "border-transparent bg-forest text-white",
  premium: "border-transparent bg-night text-white",
};

/**
 * E828: a pílula do NÍVEL é um componente só — o cartão da busca, a seção do nível na página do anúncio e a home usam
 * esta. A palavra (Essencial · Conforto · Premium) vem de ROTULO_NIVEL; o leitor de tela e o "title" dizem "Nível X",
 * para ninguém confundir o nível com um selo (como "Pronto para Morar").
 */
export function PilulaNivel({ nivel, className, testId = "card-nivel" }: { nivel: Nivel; className?: string; testId?: string }) {
  const nome = tituloNivel(nivel) ?? ROTULO_NIVEL[nivel];
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2 py-1 align-top text-[11px] font-semibold leading-3", COR_NIVEL[nivel], className)}
      data-testid={testId}
      data-nivel={nivel}
      title={nome}
      aria-label={nome}
    >
      {ROTULO_NIVEL[nivel]}
    </span>
  );
}
