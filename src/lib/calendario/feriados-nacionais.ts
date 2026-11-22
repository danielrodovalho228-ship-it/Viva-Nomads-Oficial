/*
  E948 (emenda do coordenador; decisão do Daniel, 15/11: "Pular feriados") — o calendário ÚNICO de dias úteis. PURO, sem
  rede, sem biblioteca. Todo contador de dia ou hora útil da plataforma lê daqui (prazo do dono E395/E722, horas úteis do
  laudo da vistoria, prazo da análise do documento E948), para nenhum divergir.

  Feriados NACIONAIS: 01/01 Confraternização Universal; 21/04 Tiradentes; 01/05 Dia do Trabalho; 07/09 Independência;
  12/10 Nossa Senhora Aparecida; 02/11 Finados; 15/11 Proclamação da República; 20/11 Dia Nacional de Zumbi e da
  Consciência Negra (Lei 14.759/2023); 25/12 Natal; e a Sexta-feira Santa (móvel, dois dias antes da Páscoa, calculada
  pelo algoritmo de Meeus/Jones/Butcher para qualquer ano).
  FICAM FORA: Carnaval e Corpus Christi (ponto facultativo federal, não feriado nacional) e todos os feriados estaduais e
  municipais.
  A data é sempre o dia em horário de Brasília (AAAA-MM-DD).
*/

const FIXOS: Record<string, string> = {
  "01-01": "Confraternização Universal",
  "04-21": "Tiradentes",
  "05-01": "Dia do Trabalho",
  "09-07": "Independência do Brasil",
  "10-12": "Nossa Senhora Aparecida",
  "11-02": "Finados",
  "11-15": "Proclamação da República",
  "11-20": "Dia Nacional de Zumbi e da Consciência Negra",
  "12-25": "Natal",
};

const dois = (n: number) => String(n).padStart(2, "0");

/** Domingo de Páscoa (Meeus/Jones/Butcher), como AAAA-MM-DD. */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${dois(mes)}-${dois(dia)}`;
}

/** Sexta-feira Santa: dois dias antes da Páscoa. */
export function sextaFeiraSanta(ano: number): string {
  const p = new Date(`${pascoa(ano)}T12:00:00Z`);
  p.setUTCDate(p.getUTCDate() - 2);
  return p.toISOString().slice(0, 10);
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** O nome do feriado nacional na data (AAAA-MM-DD), ou null. */
export function feriadoNacional(dataISO: string): string | null {
  const m = ISO.exec(dataISO);
  if (!m) return null;
  const fixo = FIXOS[`${m[2]}-${m[3]}`];
  if (fixo) return fixo;
  if (dataISO === sextaFeiraSanta(Number(m[1]))) return "Sexta-feira Santa";
  return null;
}

/** Dia útil: segunda a sexta e não feriado nacional. */
export function ehDiaUtil(dataISO: string): boolean {
  const m = ISO.exec(dataISO);
  if (!m) return false;
  const dow = new Date(`${dataISO}T12:00:00Z`).getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return feriadoNacional(dataISO) === null;
}
