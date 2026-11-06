/*
  O rascunho da URL chega por Server Action — e as Server Actions vão uma por vez por aba (E611), então ele pode
  chegar DEPOIS de o dono já ter adicionado fotos. Antes, aplicar o rascunho trocava a lista inteira: as fotos novas
  sumiam (lab do t204 a 390 px: 7 fotos viraram 1) e a análise da IA nunca rodava. Agora: as do rascunho primeiro, e
  depois as que entraram na tela enquanto ele carregava (as que já estavam antes — de outro rascunho — ficam de fora).
  PURO.
*/
export interface FotoComId {
  id: string;
  url: string;
}

export function mesclarFotosDoRascunho<T extends FotoComId>(doRascunho: T[], naTela: T[], jaNaTelaAntes: ReadonlySet<string>): T[] {
  const ids = new Set(doRascunho.map((f) => f.id));
  const urls = new Set(doRascunho.map((f) => f.url));
  const novas = naTela.filter((f) => !jaNaTelaAntes.has(f.id) && !ids.has(f.id) && !urls.has(f.url));
  return [...doRascunho, ...novas];
}
