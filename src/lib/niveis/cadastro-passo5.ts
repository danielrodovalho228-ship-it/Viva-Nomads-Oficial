/*
  Passo 5 do cadastro (levantamento do Daniel, 25/10). PURO.
  • E141: o Essencial é autodeclarado e publica sem foto; a foto feita na hora só sobe o nível (Conforto/Premium) e é
    opcional. Uma cobrança só, no bloco do nível.
  • E151: o subtítulo de um item não repete o título (ex.: "Internet medida no quarto principal" com "Medição válida
    no quarto principal" logo embaixo; o cartão da medição já explica o resto).
*/
import type { ItemQueFalta } from "./exibicao.ts";

export const TEXTO_ESSENCIAL_DECLARADO =
  "O Essencial é o que você declara no padrão mínimo acima: publica sem foto nenhuma.";

export const TEXTO_SUBIR_NIVEL = "Você pode publicar agora e fotografar depois. Cada item com foto sobe o anúncio de nível.";

const palavras = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 2);

/** O critério que aparece embaixo do item, ou null quando ele só repete o título (ou o cartão da medição já explica). */
export function criterioDoItemNoCadastro(item: Pick<ItemQueFalta, "rotulo" | "criterio" | "prova">): string | null {
  const c = item.criterio.trim();
  if (!c || item.prova === "medida") return null;
  const doTitulo = new Set(palavras(item.rotulo));
  const novas = palavras(c).filter((p) => !doTitulo.has(p));
  return novas.length === 0 ? null : c;
}
