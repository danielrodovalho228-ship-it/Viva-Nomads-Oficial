/*
  PRIMEIRA RESPOSTA NA HORA para chamado que fica com a equipe (PURO, testável).

  • Categorias simples (dúvida, anúncio, conta, sugestão): a Viva atende e
    resolve se puder (viva-servidor.rodarViva) — como já era.
  • Categorias SENSÍVEIS (Caução, contrato, cobrança, conflito/reclamação,
    imóvel, documentos, segurança, manutenção) e "falar com uma pessoa": o
    chamado fica com o Daniel. A Viva manda SÓ o acolhimento (número + prazo),
    sem prometer nada, e grava uma RESPOSTA SUGERIDA como nota interna para a
    equipe aprovar com 1 clique ("Aprovar e enviar" no /admin/atendimento).
*/

export const CATEGORIAS_SENSIVEIS = new Set([
  "caucao",
  "contrato",
  "cobranca",
  "conflito",
  "imovel",
  "documentos",
  "seguranca",
  "acesso_imovel",
  "manutencao",
]);

export function ehSensivel(categoria: string | null | undefined): boolean {
  return !!categoria && CATEGORIAS_SENSIVEIS.has(categoria);
}

/** Quem atende primeiro: a Viva inteira (simples) ou só o acolhimento (fica com a equipe). */
export function quemAtende(p: { vivaAtiva: boolean; emergencia: boolean; prioridade: string; pedePessoa: boolean; categoria: string }): "viva" | "equipe_com_acolhimento" | "equipe" {
  if (p.emergencia) return "equipe"; // emergência: orientação fixa e aviso imediato, nada de IA no meio
  if (p.vivaAtiva && p.prioridade !== "p1" && !p.pedePessoa && !ehSensivel(p.categoria)) return "viva";
  return "equipe_com_acolhimento";
}

const fmtPrazo = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", " às");

/** Acolhimento (texto fixo — não depende de IA e não promete nada além do prazo). */
export function textoAcolhimento(p: { numero: string; rotulo: string; prazo: Date }): string {
  return `Recebemos seu chamado ${p.numero} (${p.rotulo}). Um especialista da equipe responde até ${fmtPrazo(p.prazo)} (horário de Brasília). Se tiver prints ou documentos, pode mandar aqui mesmo.`;
}

/** Nota interna com a sugestão — mesmo formato que "Usar como resposta" já lê. */
export const CABECALHO_SUGESTAO = "Sugestão da Viva para aprovar (Aprovar e enviar = vai para a pessoa como resposta da equipe).";
export function notaSugestao(texto: string, fontes: string[]): string {
  const f = fontes.length ? `\nConsultou: ${fontes.join(", ")}.` : "";
  return `${CABECALHO_SUGESTAO}${f}\nResposta sugerida:\n${texto.trim()}`.slice(0, 5000);
}

/** Texto da resposta dentro da nota; null se a nota não é uma sugestão da Viva. */
export function respostaDaSugestao(corpo: string): string | null {
  const i = corpo.indexOf("Resposta sugerida:\n");
  if (i < 0) return null;
  const t = corpo.slice(i + "Resposta sugerida:\n".length).trim();
  return t || null;
}

/** Rascunho do laboratório (sem IA): deixa claro que é simulado. */
export const SUGESTAO_SIMULADA =
  "Olá! Conferimos o seu chamado e vamos te responder com os detalhes do seu caso. (Rascunho SIMULADO do laboratório — sem IA.)";
