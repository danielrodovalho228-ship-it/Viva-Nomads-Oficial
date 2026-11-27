/*
  E929: resumo do log do rclone (arquivo privado, nível DEBUG) para o log PÚBLICO da Action — só números e mensagens
  de erro sem caminho, URL, e-mail nem identificador. Diz o que o sync fez (novos, substituídos, movidos para
  removidos, apagados) e POR QUÊ trocou (tamanho × data, com a maior diferença de data): é o diagnóstico de uma
  cópia que recopia tudo toda noite. PURO.
*/
export interface ResumoRclone {
  novos: number;
  substituidos: number;
  movidosParaRemovidos: number;
  apagados: number;
  porData: number;
  porTamanho: number;
  maiorDiferencaData: string | null;
  erros: number;
  errosDistintos: { texto: string; vezes: number }[];
}

/** Duração do rclone ("3h0m0.5s", "1.25s", "250ms") em segundos, para comparar. */
function segundos(d: string): number {
  let s = 0;
  for (const [, n, u] of d.matchAll(/([\d.]+)(h|ms|m|s|µs|us|ns)/g)) {
    const v = Number(n);
    s += u === "h" ? v * 3600 : u === "m" ? v * 60 : u === "s" ? v : u === "ms" ? v / 1000 : 0;
  }
  return s;
}

/** Tira o caminho do objeto ("pasta/arquivo.jpg: …"), URLs, e-mails e identificadores longos. */
export function semDadoDeArquivo(msg: string): string {
  let m = msg.trim();
  const c = /^([^:]+): (.+)$/.exec(m);
  if (c && /[/.]/.test(c[1]) && !/^Attempt \d/.test(c[1])) m = c[2];
  return m
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\b[A-Za-z0-9_-]{20,}\b/g, "[id]")
    .slice(0, 200);
}

export function resumoRclone(log: string): ResumoRclone {
  const r: ResumoRclone = { novos: 0, substituidos: 0, movidosParaRemovidos: 0, apagados: 0, porData: 0, porTamanho: 0, maiorDiferencaData: null, erros: 0, errosDistintos: [] };
  let maior = -1;
  const erros = new Map<string, number>();
  for (const linha of log.split("\n")) {
    const l = /^\S+ \S+ (DEBUG|INFO|NOTICE|ERROR)\s*: (.*)$/.exec(linha);
    if (!l) continue;
    const [, nivel, resto] = l;
    if (/: Copied \(new\)$/.test(resto)) r.novos++;
    else if (/: Copied \(replaced existing\)$/.test(resto)) r.substituidos++;
    else if (/: Moved \(server-side\)/.test(resto)) r.movidosParaRemovidos++;
    else if (/: Deleted$/.test(resto)) r.apagados++;
    const dif = /: Modification times differ by ([\d.hmsµun]+)/.exec(resto);
    if (dif) {
      r.porData++;
      const s = segundos(dif[1]);
      if (s > maior) [maior, r.maiorDiferencaData] = [s, dif[1]];
    }
    if (/: Sizes differ/.test(resto)) r.porTamanho++;
    if (nivel === "ERROR") {
      r.erros++;
      const t = semDadoDeArquivo(resto);
      erros.set(t, (erros.get(t) ?? 0) + 1);
    }
  }
  r.errosDistintos = [...erros].map(([texto, vezes]) => ({ texto, vezes })).sort((a, b) => b.vezes - a.vezes).slice(0, 5);
  return r;
}

/** O que vai para o log público da Action. */
export function linhasDoResumo(r: ResumoRclone): string[] {
  const out = [
    `  sync: novos: ${r.novos} · substituídos: ${r.substituidos} · movidos para removidos: ${r.movidosParaRemovidos} · apagados: ${r.apagados}`,
    `  motivo das trocas: data diferente: ${r.porData}${r.maiorDiferencaData ? ` (maior diferença ${r.maiorDiferencaData})` : ""} · tamanho diferente: ${r.porTamanho}`,
    `  erros: ${r.erros}`,
  ];
  for (const e of r.errosDistintos) out.push(`    ${e.vezes}× ${e.texto}`);
  return out;
}
