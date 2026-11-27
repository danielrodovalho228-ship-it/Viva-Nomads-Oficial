/*
  E1192 — os feriados nacionais, para as specs que conferem um prazo em dias úteis. Lista feita AQUI, à parte do produto
  (o ensaio não lê o calendário que está a conferir): os nove feriados fixos e a Sexta-feira Santa de cada ano, por tabela.
  Os pontos facultativos (Carnaval, Corpus Christi) e os feriados estaduais e municipais não entram.
*/
const FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
/** A Sexta-feira Santa, ano a ano (até 2035; a spec falha com aviso claro depois disso, em vez de errar calada). */
const SEXTA_FEIRA_SANTA: Record<string, string> = {
  "2026": "04-03", "2027": "03-26", "2028": "04-14", "2029": "03-30", "2030": "04-19",
  "2031": "04-11", "2032": "03-26", "2033": "04-15", "2034": "04-07", "2035": "03-23",
};

/** O dia (AAAA-MM-DD) é feriado nacional? */
export function feriadoNacionalNoEnsaio(diaISO: string): boolean {
  const [ano, mes, dia] = diaISO.split("-");
  if (!(ano in SEXTA_FEIRA_SANTA)) throw new Error(`feriados-do-ensaio: falta a Sexta-feira Santa de ${ano} na tabela`);
  const mesDia = `${mes}-${dia}`;
  return FIXOS.includes(mesDia) || SEXTA_FEIRA_SANTA[ano] === mesDia;
}

/** O dia (AAAA-MM-DD) é útil? Segunda a sexta, sem feriado nacional. */
export function diaUtilNoEnsaio(diaISO: string): boolean {
  const semana = new Date(`${diaISO}T12:00:00Z`).getUTCDay();
  return semana >= 1 && semana <= 5 && !feriadoNacionalNoEnsaio(diaISO);
}
