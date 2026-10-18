/*
  Data e hora de Brasília para o contexto da Viva ("quarta-feira, 07/10/2026, 18:07").
  ATENÇÃO: o Intl NÃO aceita weekday junto de dateStyle/timeStyle — dá
  TypeError "Invalid option" (bug de 07/10: "Sugerir resposta" e a Viva caíam).
  Use sempre campos soltos, como aqui.
*/
export function agoraBRTexto(agora: Date): string {
  return agora.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "Aberto em 07/10/2026, 18:07" (Brasília) para o cabeçalho do chamado; vazio se a data for inválida. */
export function abertoEmBR(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  const texto = d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Aberto em ${texto}`;
}
