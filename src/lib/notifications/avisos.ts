/*
  E444 (Relay 57, itens 1 e 2 — Pista B): a caixa de avisos do site (o sino). PURO.
  Fonte única: cada aviso nasce do MESMO evento do catálogo do e-mail/push (TEMPLATES em eventos-email.ts). A prioridade
  vem desta tabela evento × papel; o título é SEMPRE o assunto do catálogo (nunca texto do usuário, contato ou valor).
    • crítico: pede uma ação da pessoa com consequência (assinar, responder proposta, confirmar visita…);
    • urgente: conversa ou prazo em andamento;
    • normal: o resto (informativo).
  "resolvido_em" é preenchido quando a ação do evento é feita (assinou, respondeu, confirmou): ver ACAO_RESOLVE.
*/
import type { NotificationEvent } from "./eventos-email.ts";

export type PrioridadeAviso = "critico" | "urgente" | "normal";
export type PapelAviso = "dono" | "morador" | "parceiro" | "avaliador" | "admin";

/** Pedem uma ação da pessoa, com consequência se ficar parada. */
const CRITICOS: readonly NotificationEvent[] = [
  "contract_status",
  "proposta_recebida",
  "proposta_vencendo",
  "visita_pedida",
  "estadia_aditivo_proposto",
  "estadia_encerramento_pedido",
  "documento_recusado",
  "checklist_recusado",
  "manutencao_atrasada",
  "vistoria_fora_da_busca",
  "pedido_confirmar_telefone",
];

/** Conversa ou prazo em andamento. */
const URGENTES: readonly NotificationEvent[] = [
  "new_message",
  "new_lead",
  "candidatura_nova",
  "application_received",
  "pedido_aceito",
  "pedido_resposta",
  "proposta_respondida",
  "proposta_aceita",
  "proposta_recusada",
  "visita_confirmada",
  "visita_remarcada",
  "visita_cancelada",
  "visita_vespera",
  "manutencao_nova",
  "manutencao_atualizada",
  "manutencao_mensagem",
  "manutencao_prazo",
  "conforto_prazo",
  "conforto_pendencia",
  "checkin_lembrete",
  "emergencia_chegada",
  "saida_lembrete",
  "chamado_respondido",
  "estadia_aditivo_respondido",
  "estadia_instrucoes_pendentes",
  "parceiro_pedido_novo",
  "parceiro_orcamento_recebido",
  "parceiro_horario_confirmado",
  "parceiro_lembrete",
  "parceiro_conclusao_pendente",
  "pedido_auto_confirmar",
  "vinculo_parceiro_convite",
  "vistoria_designada",
  "vistoria_concordancia",
  "vistoria_lembrete",
  "vistoria_ressalva_vencida",
  "nivel_prova_vencida",
  "calendario_conflito",
];

/** Onde o papel muda a prioridade do mesmo evento (o resto segue a coluna geral). */
const POR_PAPEL: Partial<Record<NotificationEvent, Partial<Record<PapelAviso, PrioridadeAviso>>>> = {
  // A manutenção aberta pelo morador é ação do dono; para quem abriu, é só a confirmação.
  manutencao_nova: { dono: "critico", morador: "normal" },
  // O contrato a assinar é crítico para quem assina; o aviso ao dono de "contrato pronto" também pede ação dele.
  contract_status: { dono: "critico", morador: "critico" },
  // O pedido de orçamento novo é a ação do parceiro.
  parceiro_pedido_novo: { parceiro: "critico" },
};

export function prioridadeDoAviso(evento: NotificationEvent, papel?: PapelAviso | null): PrioridadeAviso {
  const doPapel = papel ? POR_PAPEL[evento]?.[papel] : undefined;
  if (doPapel) return doPapel;
  if (CRITICOS.includes(evento)) return "critico";
  if (URGENTES.includes(evento)) return "urgente";
  return "normal";
}

/** A ação que resolve o aviso crítico do evento (preenche "resolvido_em"). */
export const ACAO_RESOLVE: Partial<Record<NotificationEvent, "assinou" | "respondeu" | "confirmou">> = {
  contract_status: "assinou",
  proposta_recebida: "respondeu",
  proposta_vencendo: "respondeu",
  visita_pedida: "confirmou",
};

/** Título do aviso: o assunto do catálogo, limpo e curto (nunca o assunto montado com texto do usuário). */
export function tituloDoAviso(assuntoDoCatalogo: string): string {
  return assuntoDoCatalogo.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || "Aviso da Viva Nomads";
}

/** Rótulo do morador para o dono ANTES do aceite (regra de máscara do prompt 6 / E427): nunca nome, foto ou contato. */
export const CANDIDATO_MASCARADO = "Candidato(a)";

/**
 * E570: o aviso de candidatura no sino nomeia quem se candidatou (pela regra de máscara: "Candidato(a)" até o aceite)
 * e o imóvel — antes era "Nova candidatura no seu imóvel", e o dono adivinhava pelo horário qual era.
 * "Nova candidatura de Candidato(a) para Casa mobiliada no Centro". Imóvel vazio: "para o seu imóvel".
 */
export function tituloAvisoCandidatura(e: { candidato?: string | null; imovel?: string | null }): string {
  const limpa = (s: string | null | undefined) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim();
  const candidato = limpa(e.candidato) || CANDIDATO_MASCARADO;
  const imovel = limpa(e.imovel).slice(0, 90);
  return tituloDoAviso(`Nova candidatura de ${candidato} para ${imovel || "o seu imóvel"}`);
}

/**
 * E550 — o aviso diz de QUAL imóvel é: "Documento aprovado · Casa mobiliada no Centro". Sem imóvel, o título fica como
 * está. O título do imóvel é cortado (90) e limpo; o filtro de contato é aplicado por quem grava.
 */
export function tituloComImovel(titulo: string, imovel: string | null | undefined): string {
  const nome = String(imovel ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);
  if (!nome || titulo.includes(nome)) return tituloDoAviso(titulo);
  return tituloDoAviso(`${titulo} · ${nome}`);
}

/**
 * E550 — o MESMO aviso não se repete no sino: um aviso ainda não lido e não resolvido do mesmo evento e do mesmo
 * objeto (ref_id) — ou, sem ref_id, com o mesmo título — é renovado (sobe para o topo) em vez de virar uma 2ª linha
 * idêntica. A chave é a do filtro de busca do aviso pendente.
 */
export function chaveDoAvisoPendente(a: { evento: string; refId?: string | null; titulo: string }): { evento: string; refId: string } | { evento: string; titulo: string } {
  return a.refId ? { evento: a.evento, refId: a.refId } : { evento: a.evento, titulo: a.titulo };
}

/**
 * E586: pendentes repetidos da MESMA chave (gravados quase juntos, os dois passando pela leitura antes da gravação):
 * fica o mais antigo (o primeiro que a pessoa pode ter visto), os outros saem. Sem linhas, null.
 */
export function duplicatasDoPendente(linhas: readonly { id: string; criado_em: string }[]): { manter: string; apagar: string[] } | null {
  if (!linhas.length) return null;
  const ordem = [...linhas].sort((a, b) => Date.parse(a.criado_em) - Date.parse(b.criado_em) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const manter = ordem[0].id;
  return { manter, apagar: linhas.filter((l) => l.id !== manter).map((l) => l.id) };
}

/** Destino do aviso: só caminho interno ("/rota"), nunca URL externa. */
export function urlDoAviso(u: string | null | undefined): string | null {
  const s = String(u ?? "");
  return s[0] === "/" && s[1] !== "/" && s[1] !== "\\" && s.length <= 300 ? s : null;
}

/** Ordem para a maior prioridade pendente. */
export const ORDEM_PRIORIDADE: Record<PrioridadeAviso, number> = { critico: 0, urgente: 1, normal: 2 };

/** Contagem de não lidas e a maior prioridade ainda pendente (não lida e não resolvida). */
export function resumoDosAvisos(avisos: readonly { prioridade: PrioridadeAviso; lido_em: string | null; resolvido_em: string | null }[]): {
  naoLidas: number;
  maiorPrioridade: PrioridadeAviso | null;
} {
  let naoLidas = 0;
  let maior: PrioridadeAviso | null = null;
  for (const a of avisos) {
    if (a.lido_em) continue;
    naoLidas++;
    if (a.resolvido_em) continue;
    if (!maior || ORDEM_PRIORIDADE[a.prioridade] < ORDEM_PRIORIDADE[maior]) maior = a.prioridade;
  }
  return { naoLidas, maiorPrioridade: maior };
}

export { CRITICOS as EVENTOS_CRITICOS, URGENTES as EVENTOS_URGENTES, POR_PAPEL as PRIORIDADE_POR_PAPEL };

/** E482: a linha de texto do aviso — sem controle nem HTML, espaços normalizados, até 140 caracteres (com "…"). */
export function textoDoAviso(s: string | null | undefined): string | null {
  const t = String(s ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > 140 ? `${t.slice(0, 139)}…` : t;
}

/**
 * E482 — o aviso de mensagem nova diz QUEM escreveu (o primeiro nome, o mesmo do e-mail) e traz a prévia no texto.
 * O imóvel entra no título pelo gravarAviso (E550). Sem remetente, o assunto do catálogo.
 */
export function avisoDeMensagem(e: { remetente?: string | null; previa?: string | null }): { titulo: string; texto: string | null } {
  const remetente = String(e.remetente ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  return { titulo: tituloDoAviso(remetente ? `Nova mensagem de ${remetente}` : "Você tem uma nova mensagem"), texto: textoDoAviso(e.previa) };
}
