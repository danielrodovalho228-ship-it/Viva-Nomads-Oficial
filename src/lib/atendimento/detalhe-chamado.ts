/*
  E1098 (ORDEM-DUET-505) — a tela de detalhe do chamado da Central, pelo mockup aprovado. Aqui ficam as regras PURAS
  do que a tela diz (node --test): os rótulos unificados de prioridade, o indicador ÚNICO do prazo, o histórico em
  linguagem simples e a conversa sem repetir a resposta.
   • Prioridade: "Urgente · P1", "Alta · P2", "Normal · P3", "Baixa · P4" — o mesmo texto no selo, no seletor e no histórico.
   • Prazo: um só indicador, o de resolução: "Resolver até hoje, 22/11, às 16:40 · Faltam 8 horas".
   • Histórico: frases ("Equipe respondeu à pessoa"), nunca o código do evento nem "de → para" cru.
   • Conversa: a resposta ao cliente aparece UMA vez. A sugestão da Viva que já foi enviada vira um aviso curto que
     aponta para a mensagem da equipe; a que está na caixa de resposta aponta para a caixa.
*/
import { PRAZOS, PROMESSA_HUMANA_H, estadoPrazo, type Prioridade } from "../../config/atendimento.ts";
import { dataBRT, diaBRT, horaBRT, ETIQUETA_BRASILIA } from "../datas-brasilia.ts";
import { categoria as categoriaDef } from "./classificar.ts";

// ── Rótulos ────────────────────────────────────────────────────────────────────────────────────────────────────
const PRIORIDADES: readonly Prioridade[] = ["p1", "p2", "p3", "p4"];

/** "Urgente · P1". Um valor fora da lista volta como veio (nunca quebra a tela). */
export function rotuloPrioridade(p: string | null | undefined): string {
  const k = String(p ?? "").toLowerCase() as Prioridade;
  return PRAZOS[k] ? `${PRAZOS[k].rotulo} · ${k.toUpperCase()}` : String(p ?? "");
}

/** As quatro opções do seletor, na ordem do mockup. */
export const OPCOES_PRIORIDADE: readonly { valor: Prioridade; rotulo: string }[] = PRIORIDADES.map((valor) => ({ valor, rotulo: rotuloPrioridade(valor) }));

const STATUS: Record<string, string> = {
  aberto: "Aberto",
  aguardando_usuario: "Aguardando resposta do usuário",
  aguardando_aprovacao: "Aguardando aprovação interna",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  encerrado: "Encerrado",
};
export function rotuloStatus(s: string | null | undefined): string {
  return STATUS[String(s ?? "")] ?? String(s ?? "");
}

export function rotuloCategoria(chave: string | null | undefined): string {
  return categoriaDef(String(chave ?? ""))?.rotulo ?? "Outro assunto";
}

/** O canal, como a equipe o lê. O chamado que nasceu do "Falar com uma pessoa" é "Chat do site". */
export function rotuloCanal(canal: string | null | undefined, peloChat: boolean): string {
  if (canal === "email") return "E-mail";
  if (canal === "app") return "Aplicativo";
  return peloChat ? "Chat do site" : "Central de Ajuda";
}

// ── Datas da tela ──────────────────────────────────────────────────────────────────────────────────────────────
const diaMes = (iso: string) => dataBRT(iso).slice(0, 5);
/** "22/11/2026, 16:40" */
export const dataEHora = (iso: string) => `${dataBRT(iso)}, ${horaBRT(iso)}`;
/** "22/11, às 08:56" */
export const diaEHoraCurtos = (iso: string) => `${diaMes(iso)}, às ${horaBRT(iso)}`;

function diaRelativo(iso: string, agora: Date): string {
  const dia = diaBRT(iso);
  const hoje = diaBRT(agora);
  if (!dia || !hoje) return "";
  const dif = Math.round((Date.parse(`${dia}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000);
  return dif === 0 ? "hoje" : dif === 1 ? "amanhã" : dif === -1 ? "ontem" : "";
}

function duracao(ms: number): { texto: string; curto: string; plural: boolean } {
  const min = Math.max(1, Math.round(Math.abs(ms) / 60_000));
  if (min < 60) return { texto: `${min} ${min === 1 ? "minuto" : "minutos"}`, curto: `${min} min`, plural: min !== 1 };
  const h = Math.round(min / 60);
  if (h < 48) return { texto: `${h} ${h === 1 ? "hora" : "horas"}`, curto: `${h} h`, plural: h !== 1 };
  const d = Math.round(h / 24);
  return { texto: `${d} dias`, curto: `${d} dias`, plural: true };
}

// ── O indicador ÚNICO do prazo ─────────────────────────────────────────────────────────────────────────────────
export type TomDoPrazo = "ok" | "risco" | "vencido" | "fechado";
export interface IndicadorDoPrazo {
  tom: TomDoPrazo;
  /** "Prazo de resolução · em risco" */
  titulo: string;
  /** "Resolver até hoje, 22/11, às 16:40" */
  quando: string;
  /** "Faltam 8 horas" (vazio no chamado fechado) */
  falta: string;
  /** "Resolução · faltam 8 h" — a linha do cartão Prazos. */
  curto: string;
  /** Quanto do prazo já passou, de 0 a 1 (a barra). */
  fracao: number;
  /** A frase inteira, no formato da ordem: "Resolver até hoje, 22/11, às 16:40 · Faltam 8 horas". */
  frase: string;
}

export function indicadorDoPrazo(c: { status: string; criado_em: string; prazo_resolucao: string }, agora: Date): IndicadorDoPrazo {
  const fim = Date.parse(c.prazo_resolucao);
  const ini = Date.parse(c.criado_em);
  const rel = diaRelativo(c.prazo_resolucao, agora);
  const ate = `${rel ? `${rel}, ` : ""}${diaEHoraCurtos(c.prazo_resolucao)}`;
  if (c.status === "resolvido" || c.status === "encerrado") {
    const titulo = `Prazo de resolução · chamado ${c.status}`;
    const quando = `O prazo era ${ate}`;
    return { tom: "fechado", titulo, quando, falta: "", curto: `Resolução · chamado ${c.status}`, fracao: 1, frase: quando };
  }
  const estado = estadoPrazo(new Date(ini), new Date(fim), agora, false);
  const resta = fim - agora.getTime();
  const d = duracao(resta);
  const quando = `Resolver até ${ate}`;
  const total = fim - ini;
  const fracao = total > 0 ? Math.min(1, Math.max(0, (agora.getTime() - ini) / total)) : 1;
  if (estado === "estourado") {
    const falta = `Venceu há ${d.texto}`;
    return { tom: "vencido", titulo: "Prazo de resolução · vencido", quando, falta, curto: `Resolução · venceu há ${d.curto}`, fracao: 1, frase: `${quando} · ${falta}` };
  }
  const falta = `${d.plural ? "Faltam" : "Falta"} ${d.texto}`;
  const curto = `Resolução · ${d.plural ? "faltam" : "falta"} ${d.curto}`;
  return { tom: estado === "em_risco" ? "risco" : "ok", titulo: `Prazo de resolução · ${estado === "em_risco" ? "em risco" : "no prazo"}`, quando, falta, curto, fracao, frase: `${quando} · ${falta}` };
}

/** A linha pequena do indicador: "Faltam 8 horas (horário de Brasília)". */
export function linhaDaFalta(i: IndicadorDoPrazo): string {
  return i.falta ? `${i.falta} (${ETIQUETA_BRASILIA})` : `(${ETIQUETA_BRASILIA})`;
}

// ── Histórico em linguagem simples ─────────────────────────────────────────────────────────────────────────────
export interface EventoDoChamado {
  acao: string;
  de: string | null;
  para: string | null;
  detalhe: string | null;
  ator_tipo: string;
  ator_nome: string | null;
  criado_em: string;
}
export interface LinhaDoHistorico {
  /** "22/11/2026 · 08:56" */
  quando: string;
  oQue: string;
  detalhe: string;
  tom: "chave" | "alerta" | "normal";
}
export interface ContextoDoHistorico {
  /** Quem abriu, como a tela mostra (primeiro nome, ou "visitante"). */
  nomeDaPessoa: string;
  canal: string;
  categoria: string;
}

const quandoNoHistorico = (iso: string) => `${dataBRT(iso)} · ${horaBRT(iso)}`;
const primeiro = (nome: string | null) => (nome ?? "").trim().split(/\s+/)[0] ?? "";
const daEquipe = (e: EventoDoChamado) => primeiro(e.ator_nome) || "Uma pessoa da equipe";
const ponto = (s: string | null) => {
  const t = (s ?? "").trim();
  if (!t) return "";
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?…]$/.test(cap) ? cap : `${cap}.`;
};

function umaLinha(e: EventoDoChamado, ctx: ContextoDoHistorico): Omit<LinhaDoHistorico, "quando"> {
  const d = ponto(e.detalhe);
  switch (e.acao) {
    case "aberto":
      return { oQue: `Chamado aberto por ${ctx.nomeDaPessoa}`, detalhe: `Canal: ${ctx.canal} · Categoria: ${ctx.categoria}.`, tom: "chave" };
    case "pediu_humano":
      return { oQue: "A pessoa pediu para falar com uma pessoa da equipe", detalhe: "Pela opção “Falar com uma pessoa”.", tom: "normal" };
    case "acolhido":
      return { oQue: "Confirmação automática enviada à pessoa", detalhe: `Acolhimento automático com o prazo de resposta de até ${PROMESSA_HUMANA_H} horas.`, tom: "normal" };
    case "resumo_ia":
      return { oQue: "Resumo gerado pela Viva (IA)", detalhe: e.detalhe === "atualizado" ? "Atualizado a pedido da equipe." : "Gerado automaticamente.", tom: "normal" };
    case "sugestao_ia":
      return /^falhou/.test(e.detalhe ?? "")
        ? { oQue: "A Viva (IA) não conseguiu gerar a sugestão", detalhe: "A equipe pode responder normalmente.", tom: "alerta" }
        : { oQue: "Sugestão de resposta gerada pela Viva (IA)", detalhe: "Fica como nota interna até a equipe enviar.", tom: "normal" };
    case "sugestao_aprovada":
      return { oQue: "Equipe respondeu à pessoa", detalhe: "A sugestão da Viva foi enviada como estava.", tom: "chave" };
    case "sugestao_editada":
      return { oQue: "Equipe respondeu à pessoa", detalhe: "A sugestão da Viva foi editada antes do envio.", tom: "chave" };
    case "respondido":
      return { oQue: "Equipe respondeu à pessoa", detalhe: e.para === "aguardando_usuario" ? "O chamado passou a aguardar a resposta do usuário." : "", tom: "chave" };
    case "respondido_viva":
    case "ia_resposta":
      return { oQue: "A Viva (IA) respondeu à pessoa", detalhe: "", tom: "normal" };
    case "escalado_2h":
      return { oQue: "Alerta de prazo enviado à equipe", detalhe: "2 horas sem resposta humana.", tom: "alerta" };
    case "escalado_6h":
      return { oQue: "Alerta de prazo enviado à equipe", detalhe: "6 horas sem resposta humana — o chamado foi destacado na Central.", tom: "alerta" };
    case "prioridade_subiu":
      return { oQue: `Prioridade aumentada para ${rotuloPrioridade(e.para)}`, detalhe: "Aumento automático por falta de resposta da equipe.", tom: "alerta" };
    case "prioridade":
      return { oQue: `Prioridade alterada para ${rotuloPrioridade(e.para)}`, detalhe: e.ator_tipo === "admin" ? `Por ${daEquipe(e)}.` : d, tom: "normal" };
    case "status":
      if (e.para === "resolvido") return { oQue: "Chamado marcado como resolvido", detalhe: e.ator_tipo === "usuario" ? "Pela própria pessoa." : `Por ${daEquipe(e)}.`, tom: "chave" };
      if (e.para === "encerrado") return { oQue: "Chamado encerrado", detalhe: `Por ${daEquipe(e)}.`, tom: "chave" };
      if (e.para === "aguardando_aprovacao") return { oQue: "Chamado enviado para aprovação interna", detalhe: `Por ${daEquipe(e)}.`, tom: "normal" };
      return { oQue: `Situação alterada para “${rotuloStatus(e.para)}”`, detalhe: "", tom: "normal" };
    case "atribuido":
      return { oQue: `Chamado atribuído a ${daEquipe(e)}`, detalhe: "", tom: "normal" };
    case "reaberto":
      return { oQue: "Chamado reaberto pela pessoa", detalhe: "", tom: "chave" };
    case "mensagem":
      return { oQue: "A pessoa enviou uma mensagem", detalhe: d, tom: "normal" };
    case "consulta_pessoa":
      return { oQue: `${daEquipe(e)} consultou o perfil da pessoa`, detalhe: "A consulta fica registrada.", tom: "normal" };
    case "devolvido_ia":
      return { oQue: "Chamado devolvido para a Viva (IA)", detalhe: d, tom: "normal" };
    case "aprovacao":
      return { oQue: "A Viva (IA) pediu aprovação interna", detalhe: d, tom: "normal" };
    case "erro_tecnico":
      return { oQue: "Erro técnico encaminhado à engenharia", detalhe: "", tom: "alerta" };
    case "ia_boa_resposta":
      return { oQue: "Resposta da Viva (IA) marcada como boa", detalhe: "", tom: "normal" };
    case "ia_corrigir":
      return { oQue: "Correção registrada para a resposta da Viva (IA)", detalhe: "", tom: "normal" };
    case "denuncia_procedente":
      return { oQue: "Denúncia marcada como procedente", detalhe: "", tom: "alerta" };
    case "tentativa_injecao":
      return { oQue: "Tentativa de mudar as regras da Viva (IA)", detalhe: "A mensagem foi ignorada.", tom: "alerta" };
    case "anuncio_pausado":
      return { oQue: "Anúncio pausado", detalhe: d, tom: "alerta" };
    case "foto_reaberta":
      return { oQue: "Foto de perfil voltou para a revisão", detalhe: "", tom: "normal" };
    case "manutencao_atrasada":
      return { oQue: "Manutenção fora do prazo", detalhe: "", tom: "alerta" };
    default: {
      const t = e.acao.replace(/_/g, " ").trim();
      return { oQue: t ? t.charAt(0).toUpperCase() + t.slice(1) : "Registro", detalhe: d, tom: "normal" };
    }
  }
}

const MESMO_MOMENTO_MS = 90_000;
const perto = (a: EventoDoChamado, b: EventoDoChamado) => Math.abs(Date.parse(a.criado_em) - Date.parse(b.criado_em)) <= MESMO_MOMENTO_MS;

/**
 * O histórico da tela: do mais recente para o mais antigo, uma frase por acontecimento. O que o sistema regista em
 * dois eventos mas é UM acontecimento sai numa linha só: a abertura pelo "Falar com uma pessoa", a resposta enviada a
 * partir da sugestão, o resumo e a sugestão gerados juntos, e os dois alertas de prazo.
 */
export function historicoEmLinguagemSimples(eventos: readonly EventoDoChamado[], ctx: ContextoDoHistorico): LinhaDoHistorico[] {
  const ord = [...eventos].sort((a, b) => Date.parse(a.criado_em) - Date.parse(b.criado_em));
  const usados = new Set<number>();
  const par = (i: number, acoes: string[]) => ord.findIndex((x, j) => j !== i && !usados.has(j) && acoes.includes(x.acao) && perto(x, ord[i]));
  const linhas: LinhaDoHistorico[] = [];
  ord.forEach((e, i) => {
    if (usados.has(i)) return;
    let linha = umaLinha(e, ctx);
    if (e.acao === "respondido" || e.acao === "sugestao_aprovada" || e.acao === "sugestao_editada") {
      const j = par(i, e.acao === "respondido" ? ["sugestao_aprovada", "sugestao_editada"] : ["respondido"]);
      if (j >= 0) {
        usados.add(j);
        const sug = e.acao === "respondido" ? ord[j] : e;
        const resp = e.acao === "respondido" ? e : ord[j];
        linha = { oQue: "Equipe respondeu à pessoa", detalhe: [umaLinha(sug, ctx).detalhe, umaLinha(resp, ctx).detalhe].filter(Boolean).join(" "), tom: "chave" };
      }
    } else if (e.acao === "aberto" || (e.acao === "pediu_humano" && /^abriu pelo/.test(e.detalhe ?? ""))) {
      // Abriu pelo "Falar com uma pessoa": é a abertura, dita uma vez.
      const j = e.acao === "aberto" ? ord.findIndex((x, k) => k !== i && !usados.has(k) && x.acao === "pediu_humano" && /^abriu pelo/.test(x.detalhe ?? "") && perto(x, e)) : par(i, ["aberto"]);
      if (j >= 0) {
        usados.add(j);
        linha = { oQue: `Chamado aberto por ${ctx.nomeDaPessoa}`, detalhe: `Pelo ${ctx.canal.toLowerCase()}, na opção “Falar com uma pessoa” · Categoria: ${ctx.categoria}.`, tom: "chave" };
      }
    } else if (e.acao === "resumo_ia" || e.acao === "sugestao_ia") {
      const j = e.detalhe === "atualizado" || /^falhou/.test(e.detalhe ?? "") ? -1 : par(i, [e.acao === "resumo_ia" ? "sugestao_ia" : "resumo_ia"]);
      if (j >= 0 && ord[j].detalhe !== "atualizado" && !/^falhou/.test(ord[j].detalhe ?? "")) {
        usados.add(j);
        linha = { oQue: "Resumo e sugestão gerados pela Viva (IA)", detalhe: "Gerados automaticamente na abertura do chamado.", tom: "normal" };
      }
    } else if (e.acao === "escalado_2h" || e.acao === "escalado_6h") {
      const j = par(i, [e.acao === "escalado_2h" ? "escalado_6h" : "escalado_2h"]);
      if (j >= 0) {
        usados.add(j);
        linha = { oQue: "Alertas de prazo enviados à equipe", detalhe: "2 horas e depois 6 horas sem resposta humana — o chamado foi destacado na Central.", tom: "alerta" };
      }
    }
    usados.add(i);
    linhas.push({ quando: quandoNoHistorico(e.criado_em), ...linha });
  });
  return linhas.reverse();
}

// ── A conversa, sem repetir a resposta ─────────────────────────────────────────────────────────────────────────
export interface MensagemDoChamado {
  id: number;
  autor: string;
  corpo: string;
  interno?: boolean;
  criado_em: string;
}
export type ItemDaConversa =
  | { tipo: "mensagem"; m: MensagemDoChamado }
  /** Nota interna comum (da equipe ou da Viva, sem resposta sugerida). */
  | { tipo: "nota"; m: MensagemDoChamado }
  /** Sugestão da Viva: `texto` só vem quando a resposta NÃO está noutro lugar da tela. */
  | { tipo: "sugestao"; m: MensagemDoChamado; estado: "enviada" | "editada" | "na-caixa" | "aberta" | "superada"; aviso: string; texto: string | null };

/**
 * A resposta ao cliente aparece UMA vez:
 *  • sugestão já enviada (como estava ou editada) → só o aviso; o texto está na mensagem da equipe, logo abaixo;
 *  • sugestão que está na caixa de resposta → só o aviso; o texto está na caixa;
 *  • sugestão aberta que não está na caixa → o texto fica na nota (é o único lugar);
 *  • sugestão superada por uma resposta da equipe → só o aviso.
 */
export function itensDaConversa(
  mensagens: readonly MensagemDoChamado[],
  eventos: readonly Pick<EventoDoChamado, "acao" | "de" | "criado_em">[],
  o: { respostaDaSugestao: (corpo: string) => string | null; naCaixa: number | null },
): ItemDaConversa[] {
  const envio = new Map<number, { editada: boolean; em: string }>();
  for (const e of eventos) {
    if (e.acao === "sugestao_aprovada" || e.acao === "sugestao_editada") envio.set(Number(e.de), { editada: e.acao === "sugestao_editada", em: e.criado_em });
  }
  const respondidaDepois = (id: number) => mensagens.some((x) => x.autor === "admin" && !x.interno && x.id > id);
  return mensagens.map((m): ItemDaConversa => {
    if (!m.interno) return { tipo: "mensagem", m };
    const sugerida = m.autor === "ia" ? o.respostaDaSugestao(m.corpo) : null;
    if (!sugerida) return { tipo: "nota", m };
    const env = envio.get(m.id);
    if (env) {
      const aviso = `Sugestão ${env.editada ? "editada" : "aprovada"} e enviada como resposta da equipe em ${diaEHoraCurtos(env.em)} — o texto está na mensagem da equipe, logo abaixo. A pessoa não vê esta nota.`;
      return { tipo: "sugestao", m, estado: env.editada ? "editada" : "enviada", aviso, texto: null };
    }
    if (respondidaDepois(m.id)) return { tipo: "sugestao", m, estado: "superada", aviso: "Sugestão não usada: a equipe respondeu com outro texto. A pessoa não vê esta nota.", texto: null };
    if (o.naCaixa === m.id) return { tipo: "sugestao", m, estado: "na-caixa", aviso: "Sugestão pronta — o texto está na caixa de resposta, logo abaixo. A pessoa não vê esta nota.", texto: null };
    return { tipo: "sugestao", m, estado: "aberta", aviso: "Sugestão ainda não enviada. A pessoa não vê esta nota.", texto: sugerida };
  });
}

/** Quantas vezes um texto de resposta aparece nos itens (a trava da "resposta única"). */
export function vezesNaConversa(itens: readonly ItemDaConversa[], resposta: string): number {
  const alvo = resposta.trim();
  if (!alvo) return 0;
  return itens.reduce((n, it) => {
    const visivel = it.tipo === "sugestao" ? `${it.aviso}\n${it.texto ?? ""}` : it.m.corpo;
    return n + (visivel.includes(alvo) ? 1 : 0);
  }, 0);
}

/** As iniciais do avatar: "DR" para "Daniel Rodovalho"; "EQ" e "IA" para a equipe e a Viva. */
export function iniciais(nome: string | null | undefined): string {
  const p = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}
