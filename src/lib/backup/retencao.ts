/*
  Resiliência 2 — retenção das cópias do banco (puro, sem I/O). Regra aprovada:
   • 14 diárias: tudo dos últimos 14 dias de calendário (hoje e os 13 anteriores) fica em banco/diario/;
   • 8 semanais: a cópia de domingo de cada uma das 8 últimas semanas (domingo a sábado) fica em banco/semanal/;
   • 3 mensais: a cópia do dia 1 de cada um dos 3 últimos meses fica em banco/mensal/ (Prompt 58: eram 12; com isso
    uma cópia de segurança expira em até ~90 dias, o prazo que vai ao RIPD).
  Se a cópia de domingo (ou do dia 1) falhou, vale a primeira cópia que deu certo depois dela na mesma semana (ou mês):
  a semana nunca fica sem cópia por causa de uma noite ruim. A cópia mais nova nunca é apagada.
  As datas são as do nome do arquivo, no calendário de Brasília ("AAAA-MM-DD_HHMM"). Nome fora do padrão nunca é
  apagado (não é nosso). E storage/removidos/AAAA-MM-DD/ com mais de 30 dias é podado.
  Roda: node --test src/lib/backup/backup.test.ts
*/

export const DIARIAS = 14;
export const SEMANAIS = 8;
export const MENSAIS = 3;
export const DIAS_REMOVIDOS = 30;

const RE_ID = /^(\d{4})-(\d{2})-(\d{2})(?:_(\d{4}))?(?:\.dump)?$/;
const DIA_MS = 86_400_000;

function diaUTC(s: string): number | null {
  const m = RE_ID.exec(s);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  // Recusa datas impossíveis (2026-02-30 etc.).
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return t;
}

const ordemId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export interface Retencao {
  diarias: string[];
  semanais: string[];
  mensais: string[];
  /** Fora de todas as regras: pode ser apagada de onde estiver. */
  apagar: string[];
}

/**
 * Quais cópias ficam. `datas`: os nomes das cópias ("AAAA-MM-DD_HHMM", com ou sem ".dump"), de qualquer pasta, sem
 * repetição. `hoje`: "AAAA-MM-DD" (Brasília). Devolve os nomes como vieram, em ordem crescente.
 */
export function quaisFicam(datas: readonly string[], hoje: string): Retencao {
  const h = diaUTC(hoje);
  if (h === null) throw new Error("hoje inválido (use AAAA-MM-DD)");
  const validas = [...new Set(datas)].filter((d) => diaUTC(d) !== null).sort(ordemId);
  const invalidas = new Set([...new Set(datas)].filter((d) => diaUTC(d) === null));

  const diarias = new Set<string>();
  const semanais = new Set<string>();
  const mensais = new Set<string>();

  // Diárias: hoje e os 13 dias anteriores (e qualquer data "no futuro", por segurança).
  const inicioDiarias = h - (DIARIAS - 1) * DIA_MS;
  for (const d of validas) if ((diaUTC(d) as number) >= inicioDiarias) diarias.add(d);

  // Semanais: semanas de domingo a sábado; as 8 últimas, contando a atual.
  const domingoAtual = h - new Date(h).getUTCDay() * DIA_MS;
  const primeiroDomingo = domingoAtual - (SEMANAIS - 1) * 7 * DIA_MS;
  const porSemana = new Map<number, string>();
  for (const d of validas) {
    const t = diaUTC(d) as number;
    if (t < primeiroDomingo || t > h) continue;
    const domingo = t - new Date(t).getUTCDay() * DIA_MS;
    if (!porSemana.has(domingo)) porSemana.set(domingo, d); // validas está em ordem: a primeira é a de domingo
  }
  for (const d of porSemana.values()) semanais.add(d);

  // Mensais: os 3 últimos meses, contando o atual.
  const hd = new Date(h);
  const mesAtual = hd.getUTCFullYear() * 12 + hd.getUTCMonth();
  const porMes = new Map<number, string>();
  for (const d of validas) {
    const t = diaUTC(d) as number;
    if (t > h) continue;
    const x = new Date(t);
    const mes = x.getUTCFullYear() * 12 + x.getUTCMonth();
    if (mes <= mesAtual - MENSAIS) continue;
    if (!porMes.has(mes)) porMes.set(mes, d);
  }
  for (const d of porMes.values()) mensais.add(d);

  // A mais nova nunca sai (mesmo que o relógio esteja errado e ela pareça velha).
  const maisNova = validas[validas.length - 1];
  if (maisNova) diarias.add(maisNova);

  const fica = new Set([...diarias, ...semanais, ...mensais, ...invalidas]);
  return {
    diarias: [...diarias].sort(ordemId),
    semanais: [...semanais].sort(ordemId),
    mensais: [...mensais].sort(ordemId),
    apagar: validas.filter((d) => !fica.has(d)),
  };
}

/** Pastas "AAAA-MM-DD" (com ou sem "/" no fim) de storage/removidos/ com mais de 30 dias. Nome fora do padrão fica. */
export function removidosParaPodar(pastas: readonly string[], hoje: string, dias = DIAS_REMOVIDOS): string[] {
  const h = diaUTC(hoje);
  if (h === null) throw new Error("hoje inválido (use AAAA-MM-DD)");
  return pastas
    .filter((p) => {
      const nome = p.replace(/\/$/, "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nome)) return false;
      const t = diaUTC(nome);
      return t !== null && h - t > dias * DIA_MS;
    })
    .sort(ordemId);
}

/** "AAAA-MM-DD" da cópia ("2026-10-19_0315.dump" → "2026-10-19"); null fora do padrão. */
export function diaDaCopia(nome: string): string | null {
  return diaUTC(nome) === null ? null : nome.slice(0, 10);
}

/**
 * O plano que copia.sh executa com o rclone, uma ação por linha: "copiar <origem> <nome> <destino>",
 * "apagar <pasta> <nome>", "purgar-removidos <AAAA-MM-DD>" e "apagar-manifesto <AAAA-MM-DD.json>". Copia antes de apagar.
 */
export type Pasta = "diario" | "semanal" | "mensal";

export function planoRetencao(hoje: string, listas: Record<Pasta, string[]>, manifestos: string[], removidos: string[]): string[] {
  const dumps = (l: string[]) => l.filter((n) => /^\d{4}-\d{2}-\d{2}_\d{4}\.dump$/.test(n));
  const em: Record<Pasta, Set<string>> = {
    diario: new Set(dumps(listas.diario)),
    semanal: new Set(dumps(listas.semanal)),
    mensal: new Set(dumps(listas.mensal)),
  };
  const todas = [...new Set([...em.diario, ...em.semanal, ...em.mensal])];
  const r = quaisFicam(todas, hoje);
  const plano: string[] = [];
  const origem = (n: string): Pasta | null => (em.diario.has(n) ? "diario" : em.semanal.has(n) ? "semanal" : em.mensal.has(n) ? "mensal" : null);
  const fica: Record<Pasta, Set<string>> = { diario: new Set(r.diarias), semanal: new Set(r.semanais), mensal: new Set(r.mensais) };

  // Primeiro copia (nunca apaga antes de a cópia existir no outro lugar).
  for (const p of ["semanal", "mensal"] as const) {
    for (const n of fica[p]) {
      if (em[p].has(n)) continue;
      const o = origem(n);
      if (o) plano.push(`copiar ${o} ${n} ${p}`);
    }
  }
  for (const p of ["diario", "semanal", "mensal"] as const) {
    for (const n of em[p]) if (!fica[p].has(n)) plano.push(`apagar ${p} ${n}`);
  }
  for (const d of removidosParaPodar(removidos, hoje)) plano.push(`purgar-removidos ${d.replace(/\/$/, "")}`);

  // Manifesto fica enquanto houver cópia daquele dia em alguma pasta.
  const diasComCopia = new Set([...r.diarias, ...r.semanais, ...r.mensais].map((n) => diaDaCopia(n)));
  for (const m of manifestos) {
    const dia = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(m)?.[1];
    if (dia && dia < hoje && !diasComCopia.has(dia)) plano.push(`apagar-manifesto ${m}`);
  }
  return plano;
}
