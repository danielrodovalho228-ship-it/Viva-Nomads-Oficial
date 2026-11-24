/*
  E964 — o job E2E nunca fica verde sem ter rodado. PURO (sem rede, sem Playwright).
  • contarListados: quantos testes o `playwright test --list --reporter=json` listou (o que DEVIA rodar).
  • contarExecutados: quantos rodaram de fato no relatório JSON. Conta passou/falhou/instável e o pulo de propósito
    (test.skip com anotação "skip"/"fixme": a decisão de pular rodou). NÃO conta: sem resultado, "interrupted" (tempo
    esgotado ou parada no meio) e "skipped" sem anotação (o "não rodou" do modo serial depois de uma falha).
  • vereditoCompletude: executados < listados → vermelho "E2E INCOMPLETO: X de Y". Nada listado também não é verde.
  • grepDaPrevia: a prévia roda só @criticos + as etiquetas dos itens do PR (@E<n>, a mesma extração do E951).
*/

type Teste = { status?: string; annotations?: { type?: string }[]; results?: { status?: string }[] };
type Suite = { specs?: { tests?: Teste[] }[]; suites?: Suite[] };
type Relatorio = { suites?: Suite[] };

function testes(r: unknown): Teste[] {
  const out: Teste[] = [];
  const andar = (s: Suite) => {
    for (const sp of s.specs ?? []) out.push(...(sp.tests ?? []));
    for (const c of s.suites ?? []) andar(c);
  };
  for (const s of (r as Relatorio | null)?.suites ?? []) andar(s);
  return out;
}

export function contarListados(lista: unknown): number {
  return testes(lista).length;
}

const PULO_DE_PROPOSITO = new Set(["skip", "fixme"]);

export function rodou(t: Teste): boolean {
  const res = t.results ?? [];
  if (!res.length) return false;
  if (res.some((r) => r.status === "passed" || r.status === "failed" || r.status === "timedOut")) return true;
  if (res.every((r) => r.status === "skipped")) return (t.annotations ?? []).some((a) => PULO_DE_PROPOSITO.has(a.type ?? ""));
  return false; // "interrupted"
}

export function contarExecutados(relatorio: unknown): number {
  return testes(relatorio).filter(rodou).length;
}

export function vereditoCompletude(executados: number, listados: number): { ok: boolean; texto: string } {
  const ok = listados > 0 && executados >= listados;
  return { ok, texto: `E2E ${ok ? "COMPLETO" : "INCOMPLETO"}: ${executados} de ${listados}` };
}

export function grepDaPrevia(itens: string[]): string {
  const validos = itens.filter((i) => /^E\d+$/.test(i));
  const criticos = "@criticos(?![\\w-])";
  return validos.length ? `${criticos}|@(?:${validos.join("|")})(?![0-9])` : criticos;
}
