/**
 * E525 (D11, QA de cliques do morador, 02/11): no centro do mapa os pins de preço se cobriam (R$ 2.430 sobre R$ 4.420;
 * o aglomerado R$ 3.130 / R$ 3.470 / R$ 3.320) e o de baixo não recebia clique. Cada pin que encosta num já colocado é
 * levado à posição livre MAIS PRÓXIMA (anéis em volta do ponto: abaixo, acima, à direita, à esquerda e diagonais). O
 * primeiro de cada grupo fica no lugar. Determinístico: a mesma entrada dá sempre a mesma saída.
 */
export type CaixaPin = { id: string; x: number; y: number; w: number; h: number }; // x, y = centro do pin na tela

const FOLGA = 4;
const ANEIS = 8;
/**
 * E988 (decisão do Gerente, DUET-0649): longe demais do próprio ponto o pin deixa de ser legível (parece de outro
 * lugar). No mapa (com quadro), o pin vai no máximo até o 4º anel em volta do ponto (~4 pins de distância); sem casa
 * livre até lá, ele entra no grupo "+N" do pin visível mais perto, em vez de ficar por cima de outro.
 */
export const ANEIS_LEGIVEIS = 4;

/** Deslocamento do pin; `agrupadoEm` = o id do pin visível que o representa no "+N" (o pin agrupado não aparece). */
export type Deslocamento = { dx: number; dy: number; agrupadoEm?: string };

/** E704: caixa fixa (centro e tamanho na tela) que o pin não pode cobrir, como o nome da cidade que o mapa-base desenha. */
export type Obstaculo = { x: number; y: number; w: number; h: number };

/**
 * E988: o afastamento com o "+N". Sem grupo, é o afastamento de sempre. Com algum grupo (mapa cheio), refaz com TODOS
 * os pins reservando a largura do "+N" (centrado: metade de cada lado): qualquer pin pode mostrar o selo sem cobrir o
 * vizinho nem sair do mapa. O preço é um pouco mais de espaço entre os pins só quando o mapa está cheio.
 */
export function afastarComGrupos(pins: readonly CaixaPin[], quadro: { w: number; h: number } | undefined, obstaculos: readonly Obstaculo[], larguraSelo: number): Map<string, Deslocamento> {
  const primeira = afastarPins(pins, quadro, obstaculos);
  if (gruposDosPins(primeira).size === 0) return primeira;
  return afastarPins(pins.map((p) => ({ ...p, w: p.w + larguraSelo })), quadro, obstaculos);
}

/** Quantos pins cada pin visível representa no "+N" (só os que têm agrupados). */
export function gruposDosPins(desloc: ReadonlyMap<string, Deslocamento>): Map<string, number> {
  const g = new Map<string, number>();
  for (const d of desloc.values()) if (d.agrupadoEm) g.set(d.agrupadoEm, (g.get(d.agrupadoEm) ?? 0) + 1);
  return g;
}

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

export function afastarPins(pins: readonly CaixaPin[], quadro?: { w: number; h: number }, obstaculos: readonly Obstaculo[] = []): Map<string, Deslocamento> {
  // Os obstáculos entram primeiro: ficam onde estão e os pins é que se afastam (como se fossem pins já colocados).
  const colocados: { l: number; r: number; t: number; b: number }[] = obstaculos.map((o) => ({ l: o.x - o.w / 2, r: o.x + o.w / 2, t: o.y - o.h / 2, b: o.y + o.h / 2 }));
  const out = new Map<string, Deslocamento>();
  // Os pins que ficaram visíveis (para escolher quem representa um pin agrupado), com o índice da caixa em `colocados`.
  const visiveis: CaixaPin[] = [];
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

  /** O pin visível que vai mostrar o "+N" de p: o de ponto mais perto (o primeiro em caso de empate). */
  const escolherAnfitriao = (p: CaixaPin): CaixaPin | null => {
    let melhor: CaixaPin | null = null;
    let dist = Infinity;
    for (const v of visiveis) {
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d < dist) {
        dist = d;
        melhor = v;
      }
    }
    return melhor;
  };

  for (const p of pins) {
    const passoY = p.h + FOLGA;
    const passoX = p.w + FOLGA;
    // E988: com o quadro, os anéis vão até a borda dele (no celular, 8 anéis de 8 direções se esgotavam e o pin ficava
    // parado em cima de outro).
    // E988: com o quadro, as casas de cada anel vão até a borda dele, mas só até o anel legível.
    const aneis = quadro ? Math.min(ANEIS_LEGIVEIS, Math.ceil(Math.max(quadro.w / passoX, quadro.h / passoY))) : ANEIS;
    let escolhido: { dx: number; dy: number } | null = { dx: 0, dy: 0 };
    // E988: o pin cujo ponto está dentro do mapa também tem de caber nele no próprio lugar (com o "+N" ele alarga e,
    // rente à borda, saía do quadro); o de ponto fora da tela (mapa arrastado) fica onde está.
    const pontoNoMapa = !!quadro && p.x >= 0 && p.x <= quadro.w && p.y >= 0 && p.y <= quadro.h;
    if (!livre(caixa(p, 0, 0), pontoNoMapa)) {
      escolhido = null;
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
    if (!escolhido) {
      // E988: sem casa legível livre — entra no "+N" do pin visível mais perto do seu ponto (sem nenhum, fica no lugar).
      const anfitriao = escolherAnfitriao(p);
      if (anfitriao) {
        out.set(p.id, { dx: 0, dy: 0, agrupadoEm: anfitriao.id });
        continue;
      }
      escolhido = { dx: 0, dy: 0 };
    }
    colocados.push(caixa(p, escolhido.dx, escolhido.dy));
    visiveis.push(p);
    out.set(p.id, escolhido);
  }
  return out;
}
