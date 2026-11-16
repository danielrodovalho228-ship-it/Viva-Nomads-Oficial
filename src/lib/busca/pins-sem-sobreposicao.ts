/**
 * E525 (D11, QA de cliques do morador, 02/11): no centro do mapa os pins de preço se cobriam (R$ 2.430 sobre R$ 4.420;
 * o aglomerado R$ 3.130 / R$ 3.470 / R$ 3.320) e o de baixo não recebia clique. Cada pin que encosta num já colocado é
 * levado à posição livre MAIS PRÓXIMA (anéis em volta do ponto: abaixo, acima, à direita, à esquerda e diagonais). O
 * primeiro de cada grupo fica no lugar. Determinístico: a mesma entrada dá sempre a mesma saída.
 */
export type CaixaPin = { id: string; x: number; y: number; w: number; h: number }; // x, y = centro do pin na tela

const FOLGA = 4;
const ANEIS = 8;

/** E704: caixa fixa (centro e tamanho na tela) que o pin não pode cobrir, como o nome da cidade que o mapa-base desenha. */
export type Obstaculo = { x: number; y: number; w: number; h: number };

/**
 * As casas do anel n (em passos de pin): primeiro as 8 de sempre (abaixo, acima, direita, esquerda e diagonais), depois
 * (E988) as outras casas do anel, da mais perto para a mais longe. Determinístico.
 */
const ANEIS_PRONTOS = new Map<number, readonly [number, number][]>();
function celulasDoAnel(n: number): readonly [number, number][] {
  const pronto = ANEIS_PRONTOS.get(n);
  if (pronto) return pronto;
  const base: [number, number][] = [[0, n], [0, -n], [n, 0], [-n, 0], [n, n], [-n, n], [n, -n], [-n, -n]];
  const resto: [number, number][] = [];
  for (let i = -n; i <= n; i++)
    for (let j = -n; j <= n; j++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== n) continue;
      if (base.some(([a, b]) => a === i && b === j)) continue;
      resto.push([i, j]);
    }
  resto.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || a[0] - b[0] || a[1] - b[1]);
  const celulas = [...base, ...resto];
  ANEIS_PRONTOS.set(n, celulas);
  return celulas;
}

export function afastarPins(pins: readonly CaixaPin[], quadro?: { w: number; h: number }, obstaculos: readonly Obstaculo[] = []): Map<string, { dx: number; dy: number }> {
  // Os obstáculos entram primeiro: ficam onde estão e os pins é que se afastam (como se fossem pins já colocados).
  const colocados: { l: number; r: number; t: number; b: number }[] = obstaculos.map((o) => ({ l: o.x - o.w / 2, r: o.x + o.w / 2, t: o.y - o.h / 2, b: o.y + o.h / 2 }));
  const out = new Map<string, { dx: number; dy: number }>();
  const caixa = (p: CaixaPin, dx: number, dy: number) => ({
    l: p.x + dx - p.w / 2 - FOLGA / 2,
    r: p.x + dx + p.w / 2 + FOLGA / 2,
    t: p.y + dy - p.h / 2 - FOLGA / 2,
    b: p.y + dy + p.h / 2 + FOLGA / 2,
  });
  // Com o quadro do mapa: o pin afastado não pode sair dele (no celular ia para fora da tela).
  const cabe = (c: { l: number; r: number; t: number; b: number }) => !quadro || (c.l >= 0 && c.t >= 0 && c.r <= quadro.w && c.b <= quadro.h);
  const livre = (c: { l: number; r: number; t: number; b: number }, afastado = true) =>
    colocados.every((o) => c.r <= o.l || c.l >= o.r || c.b <= o.t || c.t >= o.b) && (!afastado || cabe(c));

  for (const p of pins) {
    const passoY = p.h + FOLGA;
    const passoX = p.w + FOLGA;
    // E988: com o quadro, os anéis vão até a borda dele (no celular, 8 anéis de 8 direções se esgotavam e o pin ficava
    // parado em cima de outro).
    const aneis = quadro ? Math.max(ANEIS, Math.ceil(Math.max(quadro.w / passoX, quadro.h / passoY))) : ANEIS;
    let escolhido = { dx: 0, dy: 0 };
    if (!livre(caixa(p, 0, 0), false)) {
      achar: for (let n = 1; n <= aneis; n++) {
        for (const [i, j] of celulasDoAnel(n)) {
          const dx = i * passoX;
          const dy = j * passoY;
          if (livre(caixa(p, dx, dy))) {
            escolhido = { dx, dy };
            break achar;
          }
        }
      }
    }
    colocados.push(caixa(p, escolhido.dx, escolhido.dy));
    out.set(p.id, escolhido);
  }
  return out;
}
