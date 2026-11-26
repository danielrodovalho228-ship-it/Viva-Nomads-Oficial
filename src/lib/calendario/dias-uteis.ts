/*
  E1192 (ORDEM-DUET-861) — o calendário ÚNICO de dias úteis. PURO: sem rede, sem biblioteca, sem relógio.
  Dia útil = segunda a sexta, em horário de Brasília, sem os feriados nacionais oficiais. Toda conta de dia útil da
  plataforma soma por aqui (o prazo do laudo da avaliação e o relógio de 1 dia útil do dono na pré-aceitação); fora
  deste módulo não há regra de fim de semana nem lista de feriados (trava: e1192-dias-uteis.test.ts).

  Feriados NACIONAIS: 01/01 Confraternização Universal; 21/04 Tiradentes; 01/05 Dia do Trabalho; 07/09 Independência;
  12/10 Nossa Senhora Aparecida; 02/11 Finados; 15/11 Proclamação da República; 20/11 Dia Nacional de Zumbi e da
  Consciência Negra; 25/12 Natal; e a Sexta-feira Santa, dois dias antes da Páscoa (calculada para qualquer ano).
  FICAM FORA: os pontos facultativos (Carnaval, Corpus Christi) e os feriados estaduais e municipais.
*/

const H = 3_600_000;
const DIA = 24 * H;
/** Brasília: UTC−3, sem horário de verão. */
const BRT = -3 * H;

/** A nota que explica "dias úteis" ao lado de um prazo — a mesma em toda tela e em todo e-mail. */
export const NOTA_DIAS_UTEIS = "Dias úteis: segunda a sexta, sem feriados nacionais.";
/** O texto cita um prazo em dias úteis ("1 dia útil", "3 dias úteis")? É onde a nota entra. */
export const citaDiasUteis = (texto: string | null | undefined): boolean => /dias? út(?:il|eis)/i.test(texto ?? "");

const FERIADOS_FIXOS: Readonly<Record<string, string>> = {
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

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), como AAAA-MM-DD. */
function pascoa(ano: number): string {
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
function sextaFeiraSanta(ano: number): string {
  return new Date(Date.parse(`${pascoa(ano)}T12:00:00Z`) - 2 * DIA).toISOString().slice(0, 10);
}

const DIA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** O nome do feriado nacional no dia (AAAA-MM-DD), ou null. */
export function feriadoNacional(diaISO: string): string | null {
  const m = DIA_ISO.exec(diaISO);
  if (!m) return null;
  return FERIADOS_FIXOS[`${m[2]}-${m[3]}`] ?? (diaISO === sextaFeiraSanta(Number(m[1])) ? "Sexta-feira Santa" : null);
}

/** O dia (AAAA-MM-DD) de um instante, em Brasília. */
const diaEmBrasilia = (t: number) => new Date(t + BRT).toISOString().slice(0, 10);
/** 00h (Brasília) do dia do instante. */
const meiaNoiteEmBrasilia = (t: number) => Math.floor((t + BRT) / DIA) * DIA - BRT;

/**
 * É dia útil? Segunda a sexta e não feriado nacional. Aceita o dia (AAAA-MM-DD) ou um instante — o instante lê-se no
 * dia de Brasília.
 */
export function diaUtil(data: Date | string): boolean {
  const dia = typeof data === "string" ? data : diaEmBrasilia(data.getTime());
  if (!DIA_ISO.test(dia)) return false;
  const semana = new Date(`${dia}T12:00:00Z`).getUTCDay();
  return semana >= 1 && semana <= 5 && feriadoNacional(dia) === null;
}

/**
 * Soma `n` dias úteis a um instante. Começando num dia útil, cada dia útil soma 1 e o prazo sai na MESMA hora do dia.
 * Começando em dia não útil (fim de semana ou feriado nacional), a conta parte das 00h do próximo dia útil. O resultado
 * cai sempre num dia útil.
 */
export function somarDiasUteis(data: Date, n: number): Date {
  let t = data.getTime();
  if (!diaUtil(new Date(t))) {
    t = meiaNoiteEmBrasilia(t) + DIA;
    while (!diaUtil(new Date(t))) t += DIA;
  }
  for (let i = 0; i < n; i++) {
    t += DIA;
    while (!diaUtil(new Date(t))) t += DIA;
  }
  return new Date(t);
}
