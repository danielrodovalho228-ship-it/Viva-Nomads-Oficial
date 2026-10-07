/*
  Assistente Viva — regras PURAS, aplicadas EM CÓDIGO antes e depois da IA.
  A IA nunca decide estas coisas sozinha:
    • emergência, golpe/pagamento por fora e "trancado" → P1 com uma pessoa;
    • pedido de pessoa → passa na hora, sem insistir;
    • pedido de contato de terceiros → recusa padrão (contato protegido);
    • exceções, estorno, documento reprovado, mediação, exclusão com contrato,
      banimento e denúncia de anúncio → fila de aprovação do Daniel;
    • dinheiro e irritação forte → pessoa.
  E toda resposta da IA passa por `validarResposta` (contato, promessas de
  prazo fora do config, ações que ela não pode fazer, parecer jurídico, fingir
  ser humana). Sem imports de servidor (roda no node --test).
*/
import { detectarEmergencia, detectarRiscoP1 } from "./classificar.ts";
import { guardContactInfo } from "../messages/contact-guard.ts";

export function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type TipoAprovacao =
  | "estorno_cancelamento"
  | "documento_reprovado"
  | "mediacao"
  | "exclusao_conta"
  | "banir_usuario"
  | "denuncia_anuncio"
  | "excecao_regra";

export const ROTULO_APROVACAO: Record<TipoAprovacao, string> = {
  estorno_cancelamento: "Estorno ou cancelamento de assinatura",
  documento_reprovado: "Contestação de documento reprovado",
  mediacao: "Mediação entre inquilino e proprietário",
  exclusao_conta: "Exclusão de conta com contrato ativo",
  banir_usuario: "Pedido para banir ou suspender usuário",
  denuncia_anuncio: "Denúncia de anúncio falso",
  excecao_regra: "Exceção a uma regra (prazo, comissão ou plano)",
};

const APROVACAO: { tipo: TipoAprovacao; re: RegExp }[] = [
  {
    tipo: "estorno_cancelamento",
    re: /\b(cancelar|cancelamento|cancela)\b.{0,30}\b(assinatura|plano|mensalidade)|\bestorn\w*|\breembols\w*|\bdevolv\w* (o |meu )?dinheiro\b|\bcobranca (indevida|duplicada|errada)\b/,
  },
  {
    tipo: "documento_reprovado",
    re: /\bdocument\w*\b.{0,40}\b(reprovad|recusad|negad|rejeitad)\w*|\b(reprovaram|recusaram|rejeitaram|negaram)\b.{0,30}\bdocument/,
  },
  {
    tipo: "mediacao",
    re: /\bcaucao\b.{0,40}\b(nao (foi )?devolv|nao devolve|reter|retid|segurou|ficou com)|\b(nao|n) (quer|vai|quis) (me )?devolver\b.{0,30}\bcaucao|\bdevolucao da caucao\b|\b(conflito|briga|desentendimento|discussao) com (o |a )?(proprietari|inquilin|dono|dona|locador|locatari)/,
  },
  { tipo: "banir_usuario", re: /\b(banir|bloquear|suspender|expulsar)\b.{0,20}\b(usuario|proprietari|inquilin|perfil|ele|ela|essa pessoa|esse cara)/ },
  { tipo: "denuncia_anuncio", re: /\banuncio\b.{0,30}\b(falso|fake|golpe|mentiroso|nao existe|enganoso)|\bdenunci\w*\b.{0,30}\banuncio/ },
  { tipo: "excecao_regra", re: /\bexcecao\b|\babrir (uma )?excecao\b|\bdesconto na (comissao|assinatura|mensalidade)\b|\b(reduzir|baixar|tirar) a comissao\b|\bmais (de|que) 180 dias\b/ },
];

const EXCLUSAO_CONTA = /\b(excluir|apagar|deletar|encerrar|cancelar)\b.{0,15}\b(minha )?conta\b/;

const PEDE_HUMANO =
  /\b(falar|conversar|atendimento|ser atendid[oa]) (com )?(uma |um |alguma |algum )?(pessoa|humano|humana|atendente|gente de verdade|alguem de verdade)|\b(quero|prefiro|preciso de|chama) (uma |um )?(pessoa|humano|humana|atendente)\b|\batendente humano\b|\bnao quero (falar com )?(robo|bot|ia)\b/;

const PEDE_CONTATO =
  /\b(whats\w*|zap|wpp|telefone|celular|numero|contato|e-?mail|insta\w*|endereco de email)\b.{0,40}\b(do|da|dele|dela|desse|dessa) (proprietari\w*|dono|dona|inquilin\w*|locador\w*|locatari\w*|anfitri\w*|morador\w*)|\b(me )?(passa|passe|da|de|manda|mande|envia|envie|qual (e|o))\b.{0,20}\b(whats\w*|zap|wpp|telefone|celular|numero|contato|e-?mail)\b.{0,30}\b(dele|dela|proprietari|dono|dona|inquilin|locador|locatari)/;

const DINHEIRO =
  /\b(fui cobrad[oa]|me cobraram|cobraram (a mais|duas vezes|errado)|paguei|pagamento (nao|em atraso|atrasado|duplicado|errado|recusado)|boleto|multa|meu dinheiro|nota fiscal|cartao (foi )?(cobrado|recusado))\b/;

const MUITO_NEGATIVO =
  /\b(pessim[oa]|horrivel|absurdo|ridicul[oa]|vergonha|lixo|procon|processar|processo judicial|advogad[oa]|reclame aqui|palhacada|porcaria|merda|porra|caralho|vou te denunciar|nunca mais)\b/;

const INJECAO =
  /\b(ignore|ignora|esqueca|esquece|desconsidere)\b.{0,40}\b(instruc|regra|prompt|orientac)|\bsou (o |a )?(admin|administrador\w*|dono da plataforma|desenvolvedor\w*|ceo)\b|\bmodo (desenvolvedor|admin|deus)\b|\bsystem prompt\b|\bprompt do sistema\b/;

/** Pediu pessoa: as frases ("quero falar com um atendente"…) ou só "pessoa"/"humano" (o rodapé pede isso). */
export function pedeHumano(texto: string): boolean {
  const t = normalizar(texto);
  return PEDE_HUMANO.test(t) || /^(uma |um )?(pessoa|humano|humana|atendente)[\s.!]*$/.test(t.trim());
}
export function pedeContato(texto: string): boolean {
  return PEDE_CONTATO.test(normalizar(texto));
}
export function assuntoDinheiro(texto: string): boolean {
  return DINHEIRO.test(normalizar(texto));
}
export function muitoNegativo(texto: string): boolean {
  return MUITO_NEGATIVO.test(normalizar(texto));
}
export function tentativaInjecao(texto: string): boolean {
  return INJECAO.test(normalizar(texto));
}
export function tipoAprovacao(texto: string, temContratoAtivo: boolean): TipoAprovacao | null {
  const t = normalizar(texto);
  const achado = APROVACAO.find((a) => a.re.test(t))?.tipo ?? null;
  if (achado) return achado;
  // Excluir conta sem contrato ativo é autoatendimento (página Excluir conta).
  if (temContratoAtivo && EXCLUSAO_CONTA.test(t)) return "exclusao_conta";
  return null;
}

/** Golpe ou pagamento por fora (subconjunto do P1 com orientação própria). */
export function ehGolpe(texto: string): boolean {
  const t = normalizar(texto);
  return /\b(golpe|golpista|fraude|estelionat\w*|link falso|site falso)\b/.test(t) || /\b(pix|transferencia|deposito|pagar|pagamento)\b.{0,40}\b(direto|por fora|pra ele|para ele|pra ela|para ela|fora da plataforma)\b/.test(t) || /\b(direto|por fora)\b.{0,30}\b(pix|pagamento|caucao|aluguel)\b/.test(t);
}

export type Rota = "emergencia" | "p1" | "humano" | "contato" | "aprovacao" | "ia";

export interface DecisaoRota {
  rota: Rota;
  motivo: string;
  aprovacao?: TipoAprovacao;
}

/**
 * Para onde vai esta mensagem — ANTES de qualquer chamada ao modelo.
 * `respostasIA` = quantas respostas a Viva já deu neste chamado.
 */
export function rotear(texto: string, opcoes: { categoria?: string; temContratoAtivo?: boolean; respostasIA?: number } = {}): DecisaoRota {
  if (detectarEmergencia(texto)) return { rota: "emergencia", motivo: "emergência (193/190)" };
  if (detectarRiscoP1(texto) || opcoes.categoria === "seguranca" || opcoes.categoria === "acesso_imovel") {
    return { rota: "p1", motivo: ehGolpe(texto) ? "golpe ou pagamento por fora" : "risco imediato (P1)" };
  }
  if (pedeHumano(texto)) return { rota: "humano", motivo: "pediu para falar com uma pessoa" };
  if (pedeContato(texto)) return { rota: "contato", motivo: "pediu contato de terceiro" };
  const ap = tipoAprovacao(texto, !!opcoes.temContratoAtivo);
  if (ap) return { rota: "aprovacao", motivo: ROTULO_APROVACAO[ap], aprovacao: ap };
  if (assuntoDinheiro(texto) || opcoes.categoria === "cobranca") return { rota: "humano", motivo: "assunto de dinheiro" };
  if (muitoNegativo(texto)) return { rota: "humano", motivo: "pessoa muito insatisfeita" };
  if ((opcoes.respostasIA ?? 0) >= 2) return { rota: "humano", motivo: "duas respostas da Viva sem resolver" };
  return { rota: "ia", motivo: "a Viva responde" };
}

// ── Textos fixos (não passam pela IA) ──────────────────────────────────────
export const APRESENTACAO = "Sou a Viva, assistente virtual do Viva Nomads.";

export const RESPOSTA_CONTATO =
  "Não posso passar telefone, WhatsApp, e-mail ou redes sociais de outra pessoa. Para a segurança de todos, a conversa acontece toda pela plataforma: assim fica registrada e vale como prova se houver qualquer problema. Você pode falar com ela pelas Mensagens, a qualquer hora.";

/** Orientação de golpe: vai na PRIMEIRA mensagem do sistema, com ou sem IA. */
export const ORIENTACAO_GOLPE = "Não pague nada fora do que está no contrato assinado pela plataforma. A Viva Nomads nunca pede Pix ou depósito.";

export const RESPOSTA_GOLPE = `${ORIENTACAO_GOLPE} Já passei seu caso para uma pessoa da equipe, com prioridade máxima.`;

export const RESPOSTA_PESSOA = "Pronto, passei seu chamado para uma pessoa da equipe.";

export const RESPOSTA_APROVACAO =
  "Esse pedido precisa ser analisado por uma pessoa da equipe. Já juntei as informações do seu caso e encaminhei.";

/** Aviso do sistema na abertura, quando a Viva vai responder. */
export const AVISO_VIVA =
  "Recebemos. A Viva, nossa assistente virtual, responde aqui em instantes. Se preferir, é só pedir para falar com uma pessoa da equipe (resposta em até 24 h).";

export const RESPOSTA_FALHA = "Vou passar seu chamado para uma pessoa da equipe, que continua daqui.";

export function primeiroNome(nome: string | null | undefined): string | null {
  const p = (nome ?? "").trim().split(/\s+/)[0];
  return p ? p.slice(0, 30) : null;
}

/** Abertura da primeira resposta: a Viva sempre se apresenta como assistente virtual. */
export function abertura(nome: string | null): string {
  return `${nome ? `Oi, ${nome}! ` : "Oi! "}${APRESENTACAO}`;
}

// ── Conferência da resposta da IA ───────────────────────────────────────────
const HORAS_PERMITIDAS = new Set([1, 4, 24, 72]);
const DIAS_PERMITIDOS = new Set([1, 2, 3]);

const ACAO_PROIBIDA =
  /\b(estornei|reembolsei|devolvi (o|seu) dinheiro|cancelei (a|sua) assinatura|aprovei (o|seu) documento|reprovei|alterei (o )?valor|mudei (o|seu) plano|reduzi a comissao|bani|suspendi (a|o|sua|seu)|liberei a caucao|decidi (a favor|que voce tem razao)|voce tem razao e (o|a) (proprietari|inquilin))/;
const JURIDICO =
  /\b(parecer juridico|juridicamente voce|do ponto de vista juridico|voce pode processar|entre na justica|acao judicial contra|voce ganharia na justica|tem direito a indenizacao)\b/;
const FINGE_HUMANA = /\b(sou (uma )?(pessoa|humana|atendente humana|funcionaria)|nao sou (um |uma )?(robo|bot|ia|inteligencia artificial))\b/;

export interface Conferencia {
  ok: boolean;
  texto: string;
  motivo?: string;
}

/** Confere (e limpa) o texto que a IA quer mandar à pessoa. */
export function validarResposta(bruto: string): Conferencia {
  const texto = guardContactInfo((bruto ?? "").trim()).text.slice(0, 2500);
  if (!texto) return { ok: false, texto, motivo: "resposta vazia" };
  const t = normalizar(texto);
  if (texto.includes("[contato protegido]")) return { ok: false, texto, motivo: "tentou mandar contato" };
  if (ACAO_PROIBIDA.test(t)) return { ok: false, texto, motivo: "afirmou ação que a IA não pode fazer" };
  if (JURIDICO.test(t)) return { ok: false, texto, motivo: "parecer jurídico" };
  if (FINGE_HUMANA.test(t)) return { ok: false, texto, motivo: "fingiu ser humana" };
  for (const m of t.matchAll(/\b(?:em ate|dentro de|no prazo de|no maximo em|no maximo)\s+(\d+)\s*(h\b|horas?|dias?(?: uteis)?|minutos?)/g)) {
    const n = Number(m[1]);
    const unidade = m[2];
    const ok = unidade.startsWith("min") ? false : unidade.startsWith("d") ? DIAS_PERMITIDOS.has(n) : HORAS_PERMITIDAS.has(n);
    if (!ok) return { ok: false, texto, motivo: `prometeu prazo fora da regra (${m[0]})` };
  }
  return { ok: true, texto };
}
