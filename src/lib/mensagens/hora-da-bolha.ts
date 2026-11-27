/*
  E484 — a hora de envio em cada bolha da conversa, sempre no fuso de Brasília (servidor e navegador escrevem igual).
  Hoje: "14:05". Ontem: "Ontem, 14:05". Antes: "02/11, 14:05". Outro ano: "02/11/2025, 14:05". Sem data válida: null.
*/
const FUSO = "America/Sao_Paulo";

function partes(d: Date): { dia: string; mes: string; ano: string; hora: string; minuto: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return { dia: p.day, mes: p.month, ano: p.year, hora: p.hour, minuto: p.minute };
}

export function horaDaBolha(iso: string | null | undefined, agora: Date = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const m = partes(d);
  const hhmm = `${m.hora}:${m.minuto}`;
  const hoje = partes(agora);
  if (m.dia === hoje.dia && m.mes === hoje.mes && m.ano === hoje.ano) return hhmm;
  const ontem = partes(new Date(agora.getTime() - 24 * 60 * 60 * 1000));
  if (m.dia === ontem.dia && m.mes === ontem.mes && m.ano === ontem.ano) return `Ontem, ${hhmm}`;
  return m.ano === hoje.ano ? `${m.dia}/${m.mes}, ${hhmm}` : `${m.dia}/${m.mes}/${m.ano}, ${hhmm}`;
}
