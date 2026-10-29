/*
  QA-LOGIN-B v2 — resumo diário (só informativo) das entradas do admin observador pela porta de QA, na fila de
  avisos do Daniel (avisos_daniel → AVISO_DANIEL_EMAIL). PURO; o servidor está em ./resumo-porta-servidor.ts.
  Roda: node --test src/lib/qa/resumo-porta.test.ts
*/

const fuso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** O dia (AAAA-MM-DD, Brasília) anterior ao de `agora` — o resumo sai sempre sobre o dia que já fechou. */
export function diaDoResumo(agora: Date): string {
  return fuso.format(new Date(Date.parse(fuso.format(agora)) - 86_400_000 + 12 * 3_600_000));
}

/** Janela UTC do dia de Brasília (00:00–24:00 em -03:00). */
export function janelaDoDia(dia: string): { de: string; ate: string } {
  const de = new Date(`${dia}T03:00:00.000Z`);
  return { de: de.toISOString(), ate: new Date(de.getTime() + 86_400_000).toISOString() };
}

export const chaveResumoPorta = (dia: string) => `porta-qa:resumo:${dia}`;

/** O aviso: assunto e corpo com a hora e o caminho de destino de cada entrada. Nunca e-mail, chave ou IP. */
export function avisoResumoPorta(dia: string, entradas: { criado_em: string; destino: string | null }[]): { assunto: string; corpo: string; prioridade: "P3" } | null {
  if (!entradas.length) return null;
  const ddmm = `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  const linhas = entradas.slice(0, 20).map((e) => `${hora.format(new Date(e.criado_em))} → ${e.destino ?? "/dashboard"}`);
  const corpo = [
    `Só informativo, nenhuma ação exigida. O admin observador da QA entrou ${entradas.length} ${entradas.length === 1 ? "vez" : "vezes"} pela porta de QA em ${ddmm}:`,
    ...linhas,
    entradas.length > linhas.length ? `… e mais ${entradas.length - linhas.length}.` : "",
    "Detalhes em Admin → Sistema → Porta de QA. Para desligar: apagar QA_LOGIN_KEY_HASH na Vercel (tudo) ou virar PRE_LANCAMENTO (só o admin).",
  ].filter(Boolean);
  return { assunto: `Porta de QA: ${entradas.length} ${entradas.length === 1 ? "entrada" : "entradas"} do admin observador em ${ddmm}`, corpo: linhas.length ? corpo.join("\n").slice(0, 1000) : "", prioridade: "P3" };
}
