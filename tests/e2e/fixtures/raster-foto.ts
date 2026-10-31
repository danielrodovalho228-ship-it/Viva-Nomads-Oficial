/**
 * Pixels (RGB, 3 bytes cada) da foto de teste do laboratório. Puro: o PNG é montado em laboratorio.ts.
 * Gradiente + textura determinística, para NÃO parecer print de tela (áreas chapadas, poucas cores) ao filtro
 * de conteúdo das fotos (src/lib/fotos/conteudo.ts). `n` muda a cor e a textura: cada foto é diferente.
 */
export function rasterDeTeste(n: number, w = 640, h = 480): { rgb: Uint8Array; w: number; h: number } {
  const cor = [(60 + n * 23) % 160, (90 + n * 41) % 160, (120 + n * 67) % 160];
  const rgb = new Uint8Array(w * h * 3);
  let s = (n * 2654435761 + 12345) >>> 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        const ruido = (s >>> 24) % 17; // 0..16
        const grad = c === 0 ? (x / w) * 70 : c === 1 ? (y / h) * 70 : ((x + y) / (w + h)) * 70;
        rgb[o + c] = Math.min(255, Math.round(cor[c] + grad + ruido));
      }
    }
  }
  return { rgb, w, h };
}
