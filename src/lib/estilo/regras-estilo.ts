/*
  Regras do padrão visual (Prompt 40, Estudo 1) — PURO. Usado pela guarda
  `estilo-padrao.test.ts` e pela contagem do que ainda falta fora do alcance.

  - sombra: só `shadow-flutuante` (o botão flutuante) e `shadow-none`;
  - raio: só 8 px (`rounded-lg` / `rounded-control`), 12 px (`rounded-xl` /
    `rounded-media`), `rounded-full` e `rounded-none`;
  - espaço (padding, margin, gap, space): só a escala de 4 px — nada de meio
    passo (`p-2.5` = 10 px) nem valor arbitrário fora dela (`p-[13px]`);
  - peso: nada de `font-bold`, `font-extrabold`, `font-black` (só 400 e 600).
  Adendo do Prompt 40:
  - nada de `uppercase` com `tracking-*` (caixa alta espaçada) em texto de interface;
  - nada de gradiente (`bg-gradient-*`, `bg-linear-*`, `text-gradient-*`…) em tela do produto;
  - teto de 28 px (`text-3xl`+ ou `text-[Npx]` > 28); só o h1 do hero listado vai até 40 px;
  - o cinza de apoio (`text-apoio`, #6A6A6A) só em miúdo e legenda (≤ 14 px), nunca no corpo.
*/

export type TipoViolacao = "sombra" | "raio" | "espaco" | "peso" | "caixa-alta" | "gradiente" | "tamanho" | "apoio";

export interface Violacao {
  tipo: TipoViolacao;
  classe: string;
  linha: number;
}

const FIM = `(?=$|[\\s"'\`{}),;])`;
const INICIO = `(?:^|[\\s"'\`{(,])`;
/** Prefixos de variante (`sm:`, `hover:`, `group-hover:`, `aria-pressed:`…) e o `!` de importante. */
const VARIANTES = `(?:[a-z0-9-]+(?:\\[[^\\]\\s]*\\])?:)*!?`;

/** Resto de uma classe: valor arbitrário entre colchetes (pode ter vírgula) ou caracteres comuns. */
const RESTO = `(?:\\[[^\\]\\s]*\\]|[^\\s"'\`{}),;\\[])+`;

const RE_SOMBRA = new RegExp(`${INICIO}${VARIANTES}((?:drop-)?shadow(?:-${RESTO})?)${FIM}`, "g");
const SOMBRAS_OK = new Set(["shadow-flutuante", "shadow-none"]);

const RE_RAIO = new RegExp(`${INICIO}${VARIANTES}(rounded(?:-${RESTO})?)${FIM}`, "g");
const RAIOS_OK = new Set(["lg", "xl", "full", "none", "control", "media"]);

const PREFIXOS_ESPACO = "(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y)";
const RE_ESPACO = new RegExp(`${INICIO}${VARIANTES}(-?${PREFIXOS_ESPACO}-(${RESTO}))${FIM}`, "g");

const RE_PESO = new RegExp(`${INICIO}${VARIANTES}(font-(?:bold|extrabold|black))${FIM}`, "g");

/**
 * Grade de 4 px (Prompt 47): os únicos espaços são 4/8/12/16/24/32/48/64 px — passos 1, 2, 3, 4, 6, 8, 12 e 16 do
 * Tailwind. Folga de elemento fixo (barra, botão flutuante) usa variável CSS (`pb-(--folga-flutuante)`).
 */
export const PASSOS_GRADE = new Set([0, 1, 2, 3, 4, 6, 8, 12, 16]);
export const PX_GRADE = new Set([0, 4, 8, 12, 16, 24, 32, 48, 64]);

/** Valor de espaço permitido? Passo da grade, `auto`/`px`/`0`, variável CSS ou arbitrário com px da grade. */
export function espacoPermitido(valor: string): boolean {
  if (/^\d+$/.test(valor)) return PASSOS_GRADE.has(Number(valor)); // 1 = 4 px, 2 = 8 px, …
  if (valor === "auto" || valor === "px" || valor === "0") return true;
  if (/^\d+\.\d+$/.test(valor)) return false; // meio passo: 0.5 = 2 px, 1.5 = 6 px, 2.5 = 10 px
  if (/^\(--[\w-]+\)$/.test(valor)) return true; // variável CSS: p-(--folga)
  const arb = valor.match(/^\[(.+)\]$/)?.[1];
  if (!arb) return true; // fração ou nome desconhecido: não é espaço em px
  const medidas = [...arb.matchAll(/(-?\d*\.?\d+)(px|rem)/g)];
  if (!medidas.length) return true; // env(), var() sem número
  return medidas.every(([, n, u]) => {
    const px = Math.abs(Number(n)) * (u === "rem" ? 16 : 1);
    return PX_GRADE.has(px);
  });
}

const RE_GRADIENTE = new RegExp(`${INICIO}${VARIANTES}((?:bg|text)-(?:gradient|linear|radial|conic)(?:-${RESTO})?)${FIM}`, "g");
const RE_TAMANHO = new RegExp(`${INICIO}${VARIANTES}(text-(\\d?xl|\\[[\\d.]+(?:px|rem)\\]))${FIM}`, "g");
const PX_TAMANHO: Record<string, number> = { "3xl": 30, "4xl": 36, "5xl": 48, "6xl": 60, "7xl": 72, "8xl": 96, "9xl": 128 };
const RE_PEQUENO = /(?:^|[\s"'`])(?:[a-z0-9-]+:)*text-(?:xs|sm|\[(?:1[0-4])px\])(?=$|[\s"'`])/;

/** Tamanho em px de `text-3xl` / `text-[30px]` / `text-[2rem]` (0 = até 2xl, sempre dentro do teto). */
export function pxDoTamanho(valor: string): number {
  if (PX_TAMANHO[valor]) return PX_TAMANHO[valor];
  const arb = valor.match(/^\[([\d.]+)(px|rem)\]$/);
  if (arb) return Number(arb[1]) * (arb[2] === "rem" ? 16 : 1);
  return 0;
}

/**
 * Regras do adendo. `heroAte40` libera até 40 px nas linhas com <h1 (o hero da home e das páginas de marketing).
 */
export function violacoesAdendo(texto: string, opcoes: { heroAte40?: boolean } = {}): Violacao[] {
  const out: Violacao[] = [];
  texto.split("\n").forEach((l, i) => {
    const linha = i + 1;
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
    for (const classes of l.match(/(?:className=|cn\(|"|`)[^"`]*/g) ?? [l]) {
      if (/(?:^|[\s"'`])uppercase(?=$|[\s"'`])/.test(classes) && /(?:^|[\s"'`])tracking-/.test(classes)) {
        out.push({ tipo: "caixa-alta", classe: "uppercase + tracking", linha });
      }
    }
    for (const m of l.matchAll(RE_GRADIENTE)) out.push({ tipo: "gradiente", classe: m[1], linha });
    for (const m of l.matchAll(RE_TAMANHO)) {
      const px = pxDoTamanho(m[2]);
      const teto = opcoes.heroAte40 && /<h1\b/.test(l) ? 40 : 28;
      if (px > teto) out.push({ tipo: "tamanho", classe: m[1], linha });
    }
    if (/(?:^|[\s"'`:])text-apoio(?=$|[\s"'`])/.test(l) && !RE_PEQUENO.test(l)) out.push({ tipo: "apoio", classe: "text-apoio sem tamanho miúdo", linha });
  });
  return out;
}

/** Lista as violações de um arquivo (.tsx/.ts/.css). Comentários de linha `//` e blocos `/* *\/` contam só se tiverem classe; o normal é não terem. */
export function violacoesEstilo(texto: string): Violacao[] {
  const out: Violacao[] = [];
  texto.split("\n").forEach((l, i) => {
    const linha = i + 1;
    // Comentário puro (explicação) não é classe.
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
    for (const m of l.matchAll(RE_SOMBRA)) if (!SOMBRAS_OK.has(m[1])) out.push({ tipo: "sombra", classe: m[1], linha });
    for (const m of l.matchAll(RE_RAIO)) {
      const sufixo = m[1].replace(/^rounded(?:-(?:tl|tr|br|bl|ss|se|es|ee|t|r|b|l|s|e)(?=-|$))?-?/, "");
      if (!RAIOS_OK.has(sufixo) && !/^\[(8|12)px\]$/.test(sufixo)) out.push({ tipo: "raio", classe: m[1], linha });
    }
    for (const m of l.matchAll(RE_ESPACO)) if (!espacoPermitido(m[2])) out.push({ tipo: "espaco", classe: m[1], linha });
    for (const m of l.matchAll(RE_PESO)) out.push({ tipo: "peso", classe: m[1], linha });
  });
  return out;
}
