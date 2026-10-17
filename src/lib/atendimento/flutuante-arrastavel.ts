/**
 * Botão flutuante "Fale com a Viva" ARRASTÁVEL (ordem a9982623). Lógica pura:
 * o botão fica parado no canto (sem recalcular em scroll), a pessoa pode arrastá-lo;
 * ao soltar ele gruda na borda lateral mais próxima, mantendo a altura, e a posição
 * fica salva no aparelho. Clique curto continua abrindo o chat.
 */

/** Movimento (px) a partir do qual o toque/clique vira arraste e deixa de abrir o chat. */
export const LIMIAR_ARRASTE_PX = 6;
/** Folga entre o botão e a borda da tela. */
export const MARGEM_PX = 12;
export const CHAVE_POSICAO = "vivanomads-viva-posicao";

export type Lado = "esq" | "dir";
/** Posição salva: lado da tela e distância (px) da base da janela até a base do botão. */
export type Posicao = { lado: Lado; baixo: number };
export type Tela = { largura: number; altura: number; seguroBaixo?: number; seguroTopo?: number };
export type Tamanho = { largura: number; altura: number };

/** Moveu o bastante para ser arraste (e não um clique)? */
export function ehArraste(dx: number, dy: number, limiar = LIMIAR_ARRASTE_PX): boolean {
  return Math.hypot(dx, dy) > limiar;
}

/** Mantém `baixo` dentro da tela (com margem e áreas seguras). */
export function limitarBaixo(baixo: number, tela: Tela, botao: Tamanho, margem = MARGEM_PX): number {
  const min = margem + (tela.seguroBaixo ?? 0);
  const max = Math.max(min, tela.altura - botao.altura - margem - (tela.seguroTopo ?? 0));
  if (!Number.isFinite(baixo)) return min;
  return Math.round(Math.min(Math.max(baixo, min), max));
}

/**
 * Ao soltar: `centroX` é o centro horizontal do botão e `base` a distância da base da
 * janela à base do botão. Escolhe a borda lateral mais próxima e limita a altura.
 */
export function grudarNaBorda(centroX: number, base: number, tela: Tela, botao: Tamanho, margem = MARGEM_PX): Posicao {
  return { lado: centroX < tela.largura / 2 ? "esq" : "dir", baixo: limitarBaixo(base, tela, botao, margem) };
}

/** Posição durante o arraste: segue o dedo, sem sair da tela. */
export function posicaoDuranteArraste(esquerda: number, base: number, tela: Tela, botao: Tamanho, margem = MARGEM_PX): { esquerda: number; baixo: number } {
  const maxEsq = Math.max(margem, tela.largura - botao.largura - margem);
  return { esquerda: Math.round(Math.min(Math.max(esquerda, margem), maxEsq)), baixo: limitarBaixo(base, tela, botao, margem) };
}

type Armazenamento = Pick<Storage, "getItem" | "setItem">;

/** Lê a posição salva; qualquer problema (sem storage, JSON ruim, valores estranhos) → null = padrão. */
export function lerPosicao(storage: Armazenamento | null | undefined): Posicao | null {
  try {
    const v = JSON.parse(storage?.getItem(CHAVE_POSICAO) ?? "null") as Partial<Posicao> | null;
    if (!v || (v.lado !== "esq" && v.lado !== "dir") || typeof v.baixo !== "number" || !Number.isFinite(v.baixo)) return null;
    return { lado: v.lado, baixo: v.baixo };
  } catch {
    return null;
  }
}

export function gravarPosicao(storage: Armazenamento | null | undefined, p: Posicao): boolean {
  try {
    storage?.setItem(CHAVE_POSICAO, JSON.stringify(p));
    return !!storage;
  } catch {
    return false;
  }
}
