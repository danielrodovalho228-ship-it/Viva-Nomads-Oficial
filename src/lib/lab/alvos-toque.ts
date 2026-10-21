/** Regra da varredura de 390/1280 px do laboratório (ordem 21708cca, parte D): sem rolagem lateral e alvos de toque ≥ 44 px. */

export const ALVO_MINIMO_PX = 44;

export type AlvoMedido = { seletor: string; largura: number; altura: number };

/** Sobra de largura da página (px). Até 1 px de arredondamento é aceito. */
export function rolagemLateral(scrollWidth: number, larguraJanela: number): number {
  return Math.max(0, scrollWidth - larguraJanela);
}

export function temRolagemLateral(scrollWidth: number, larguraJanela: number): boolean {
  return rolagemLateral(scrollWidth, larguraJanela) > 1;
}

/** Alvo pequeno demais: altura menor que 44 px (tolerância de 1 px) — a largura só conta se também for menor. */
export function alvoPequeno(a: AlvoMedido): boolean {
  return a.altura < ALVO_MINIMO_PX - 1 && a.largura < ALVO_MINIMO_PX * 3;
}

/** Texto curto para a mensagem do teste: seletor e medida (nunca o HTML nem o texto da página). */
export function descreverAlvos(alvos: AlvoMedido[], max = 8): string {
  return alvos
    .filter(alvoPequeno)
    .slice(0, max)
    .map((a) => `${a.seletor} ${Math.round(a.largura)}x${Math.round(a.altura)}`)
    .join("\n");
}
