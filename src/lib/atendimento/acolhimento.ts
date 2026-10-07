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
export function textoAcolhimento(p: { numero: string; rotulo: string; prazo: Date; respondidoPelaViva?: boolean }): string {
  if (p.respondidoPelaViva) {
    return `Recebemos seu chamado ${p.numero} (${p.rotulo}). A Viva já respondeu logo abaixo com a informação oficial. Se precisar de mais alguma coisa, é só responder: uma pessoa da equipe continua daqui até ${fmtPrazo(p.prazo)} (horário de Brasília).`;
  }
  return `Recebemos seu chamado ${p.numero} (${p.rotulo}). Um especialista da equipe responde até ${fmtPrazo(p.prazo)} (horário de Brasília). Se tiver prints ou documentos, pode mandar aqui mesmo.`;
}

// ── Viva com autonomia (decisão do Daniel, 07/10/2026) ─────────────────────
/*
  Mesmo em categoria sensível (Caução, contrato…) e em "falar com uma pessoa",
  a Viva RESPONDE SOZINHA quando a resposta está 100% no conhecimento oficial.
  Espera a aprovação do Daniel quando o caso envolve: dinheiro já pago,
  reembolso/estorno, disputa ou conflito, ameaça jurídica, dado pessoal, golpe
  — ou quando a própria sugestão admite que falta informação.
*/
const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const RISCOS: { motivo: string; re: RegExp }[] = [
  { motivo: "dinheiro já pago", re: /\b(ja )?(paguei|pagamos|foi pago|ja pago|transferi|depositei|cobrad[oa] (a mais|duas vezes|indevid))|\bcobranca indevida\b/ },
  { motivo: "reembolso ou estorno", re: /\breembols|\bestorn|\bdevolv(a|am|er|ido|ida) (o|meu|minha)? ?(dinheiro|valor|pagamento|caucao)|\b(nao|n) (me )?devolve|\bdevolucao (do|da) (dinheiro|valor|caucao).{0,20}(atras|nao|demor)|\bquero (o|meu) dinheiro|\bcaucao.{0,40}\b(nao|ainda nao) (foi |me )?(devolvid|devolveram|recebi|caiu)|\b(nao|ainda nao) (recebi|devolveram)/ },
  { motivo: "disputa ou conflito", re: /\b(disputa|conflito|briga|discussao|desentendimento|reclamacao formal|me enganou|enganad[oa]|calote)/ },
  { motivo: "ameaça jurídica", re: /\b(advogad|processo|processar|procon|justica|judicial|denunci|boletim de ocorrencia|delegacia|danos morais)/ },
  { motivo: "dado pessoal", re: /\b(cpf|rg|cnh|passaporte|numero do cartao|cartao de credito|conta bancaria|agencia e conta|senha)\b|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/ },
  { motivo: "golpe ou pagamento por fora", re: /\b(golpe|fraude|pix (por fora|direto)|pagar por fora)/ },
];
const SEM_INFORMACAO = /nao (tenho|temos|encontrei|sei|consigo (confirmar|verificar))|ainda nao tenho essa informacao|vou (verificar|confirmar) com a equipe|preciso confirmar|a equipe (vai|ira) (verificar|confirmar)/;

/** Precisa da aprovação do Daniel? Devolve o motivo (ou null = a Viva pode responder sozinha). */
export function motivoParaAprovacao(textoPessoa: string, sugestao: string | null, avisoRegras: string | null = null): string | null {
  const t = norm(textoPessoa);
  for (const r of RISCOS) if (r.re.test(t)) return r.motivo;
  if (!sugestao || !sugestao.trim()) return "sem sugestão da Viva";
  if (avisoRegras) return `regras de texto: ${avisoRegras}`;
  if (SEM_INFORMACAO.test(norm(sugestao))) return "a Viva não tem a informação oficial";
  return null;
}

// ── Escalonamento (chamado esperando a equipe) ─────────────────────────────
/** Status em que a vez é da equipe (não da pessoa). */
export const STATUS_COM_A_EQUIPE = ["aberto", "em_andamento", "aguardando_aprovacao"] as const;
/** 2 h sem resposta humana → push ao Daniel; 6 h → vermelho no topo da Central e no boletim do Moacir. */
export const ESCALONAMENTO_H = { aviso: 2, vermelho: 6 } as const;

export function nivelEscalonamento(c: { status: string; responsavel_tipo: string; criado_em: string; respondidoPorPessoa: boolean }, agora: Date): 0 | 2 | 6 {
  if (c.respondidoPorPessoa || c.responsavel_tipo !== "humano" || !(STATUS_COM_A_EQUIPE as readonly string[]).includes(c.status)) return 0;
  const h = (agora.getTime() - new Date(c.criado_em).getTime()) / 3_600_000;
  return h >= ESCALONAMENTO_H.vermelho ? 6 : h >= ESCALONAMENTO_H.aviso ? 2 : 0;
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
