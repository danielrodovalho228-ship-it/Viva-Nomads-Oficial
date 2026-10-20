/*
  Regras do padrão visual (Prompt 40, Estudo 1) — PURO. Usado pela guarda
  `estilo-padrao.test.ts` e pela contagem do que ainda falta fora do alcance.

  - sombra: só `shadow-flutuante` (o botão flutuante) e `shadow-none`;
  - raio: só 8 px (`rounded-lg` / `rounded-control`), 12 px (`rounded-xl` /
    `rounded-media`), `rounded-full` e `rounded-none`;
  - espaço (padding, margin, gap, space): só a escala de 4 px — nada de meio
    passo (`p-2.5` = 10 px) nem valor arbitrário fora dela (`p-[13px]`);
  - peso: nada de `font-bold`, `font-extrabold`, `font-black` (só 400 e 600).
*/

export type TipoViolacao = "sombra" | "raio" | "espaco" | "peso";

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

/** Valor de espaço permitido? Passo inteiro da escala, `auto`/`px`/`0`, ou arbitrário em múltiplos de 4 px. */
export function espacoPermitido(valor: string): boolean {
  if (/^\d+$/.test(valor)) return true; // 1 = 4 px, 2 = 8 px, …
  if (valor === "auto" || valor === "px" || valor === "0") return true;
  if (/^\d+\.\d+$/.test(valor)) return false; // meio passo: 0.5 = 2 px, 1.5 = 6 px, 2.5 = 10 px
  if (/^\(--[\w-]+\)$/.test(valor)) return true; // variável CSS: p-(--folga)
  const arb = valor.match(/^\[(.+)\]$/)?.[1];
  if (!arb) return true; // fração ou nome desconhecido: não é espaço em px
  const medidas = [...arb.matchAll(/(-?\d*\.?\d+)(px|rem)/g)];
  if (!medidas.length) return true; // env(), var() sem número
  return medidas.every(([, n, u]) => {
    const px = Math.abs(Number(n)) * (u === "rem" ? 16 : 1);
    return px === 0 || px % 4 === 0;
  });
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
