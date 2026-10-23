/*
  Prompt 62-B1 — avaliação do imóvel por avaliador credenciado (internamente: categoria "vistoria"). PURO (node --test).
  Na tela: "avaliação do imóvel" e "avaliador credenciado"; nunca "inspeção", "perícia" ou "engenharia".
  Tudo atrás da chave VISTORIA_ATIVA (desligada): sem ela, nada aparece para o dono nem para o morador; o credenciamento
  e o admin funcionam para montar a rede antes do lançamento.
  - A Viva designa o avaliador por rodízio; o dono NUNCA escolhe.
  - Preço vem da tabela do admin (vistoria_precos), nunca do código; tabela vazia na cidade = o pedido não abre.
  - O dono paga a avaliação, não o resultado. Com PAGAMENTO_PARCEIROS_ATIVO desligada, paga direto ao avaliador e a
    plataforma só registra (o avaliador marca "recebido", o dono confirma).
*/
import { chaveCidade } from "../cidades.ts";

export const ROTULO_CATEGORIA_VISTORIA = "Avaliação de imóveis";
export const FRASE_PAGA_AVALIACAO = "Você paga a avaliação, não o resultado.";
/** O que todo valor da tabela inclui (exibido no pedido, junto do texto da tabela). */
export const INCLUI_SEMPRE = ["A visita ao imóvel.", "O laudo em até 48 horas úteis.", "Se o resultado vier com ressalvas: a reverificação dos itens da ressalva em até 15 dias, pelo mesmo avaliador."] as const;

/*
  Adendo 62-B1 (coordenador, 23/10) — a FRONTEIRA entre o que está incluído e o que é outra avaliação:
  - REVERIFICAÇÃO INCLUÍDA: só no resultado "com ressalvas", dentro dos 15 dias, só dos itens da ressalva, pelo MESMO
    avaliador (por foto ou visita, conforme o item). Faz parte do valor já pago: nunca gera cobrança. Fora disso não existe.
  - NOVA AVALIAÇÃO: depois de "reprovado" ou de ressalva vencida. Avaliação completa, novo pedido, designada por rodízio
    (por regra, outro avaliador), pelo valor da tabela — menos a condição de retorno da cidade, se ela existir.
  A condição de retorno (retorno_dias + retorno_percentual) é preenchida pelo admin depois da cotação; nula = não existe e
  nenhum texto fala em desconto.
*/
export const TEXTO_REVERIFICACAO_INCLUIDA = "A reverificação dos itens da ressalva, pelo mesmo avaliador, está incluída no valor já pago.";
export const TEXTO_NOVA_AVALIACAO = "Para voltar a ter \"· vistoriado\", peça uma nova avaliação: avaliação completa, novo pedido, outro avaliador pelo rodízio, pelo valor da tabela.";

// ── Porte (do anúncio: quartos) ────────────────────────────────────────────────────────────────────────────────
export const PORTES = ["estudio", "q1_2", "q3_mais"] as const;
export type Porte = (typeof PORTES)[number];
export const ROTULO_PORTE: Record<Porte, string> = { estudio: "Estúdio", q1_2: "1 ou 2 quartos", q3_mais: "3 quartos ou mais" };

export function porteDoImovel(quartos: number | null | undefined): Porte {
  const q = Math.max(0, Math.floor(Number(quartos) || 0));
  return q === 0 ? "estudio" : q <= 2 ? "q1_2" : "q3_mais";
}

// ── Tabela de preço (D2) ───────────────────────────────────────────────────────────────────────────────────────
export interface LinhaPreco {
  cidade: string;
  porte: Porte;
  valor: number;
  incluiTexto: string | null;
  vigenteDesde: string;
  /** Condição de retorno da cidade (adendo 62-B1): os dois nulos = não existe. */
  retornoDias?: number | null;
  retornoPercentual?: number | null;
}

/** Colunas lidas de vistoria_precos (uma lista só para todo select). */
export const COLUNAS_PRECO = "cidade, porte, valor, inclui_texto, vigente_desde, retorno_dias, retorno_percentual";

/** Linha do banco → LinhaPreco. */
export function linhaDaTabela(l: { cidade: string; porte: Porte; valor: number | string; inclui_texto: string | null; vigente_desde: string; retorno_dias?: number | null; retorno_percentual?: number | string | null }): LinhaPreco {
  return {
    cidade: l.cidade,
    porte: l.porte,
    valor: Number(l.valor),
    incluiTexto: l.inclui_texto,
    vigenteDesde: l.vigente_desde,
    retornoDias: l.retorno_dias ?? null,
    retornoPercentual: l.retorno_percentual == null ? null : Number(l.retorno_percentual),
  };
}

/** O valor vigente para a cidade e o porte na data (a linha mais recente já em vigor). Sem linha válida → null. */
export function precoVigente(tabela: LinhaPreco[], cidade: string, porte: Porte, agora: Date): LinhaPreco | null {
  const c = chaveCidade(cidade);
  const t = agora.getTime();
  const validas = tabela
    .filter((l) => chaveCidade(l.cidade) === c && l.porte === porte && Number(l.valor) > 0 && Date.parse(l.vigenteDesde) <= t)
    .sort((a, b) => Date.parse(b.vigenteDesde) - Date.parse(a.vigenteDesde));
  return validas[0] ?? null;
}

/** A cidade tem valor para os 3 portes? (condição para ligar a chave e o que o admin mostra). */
export function tabelaCompleta(tabela: LinhaPreco[], cidade: string, agora: Date): boolean {
  return PORTES.every((p) => precoVigente(tabela, cidade, p, agora) != null);
}

export interface CondicaoRetorno {
  dias: number;
  percentual: number;
}

/** A condição de retorno da linha da tabela, só quando os dois campos são válidos (dias > 0; 0 < percentual ≤ 100). */
export function condicaoRetorno(l: Pick<LinhaPreco, "retornoDias" | "retornoPercentual"> | null | undefined): CondicaoRetorno | null {
  const dias = Number(l?.retornoDias);
  const percentual = Number(l?.retornoPercentual);
  if (l?.retornoDias == null || l?.retornoPercentual == null) return null;
  if (!Number.isInteger(dias) || dias <= 0 || !(percentual > 0) || percentual > 100) return null;
  return { dias, percentual };
}

/**
 * Valor da NOVA AVALIAÇÃO (depois de "reprovado" ou de ressalva vencida em `desde`): a tabela vigente, menos a condição
 * de retorno da cidade só se ela existir e só dentro de retorno_dias. Sem condição: valor cheio, sempre.
 */
export function valorNovaAvaliacao(preco: Pick<LinhaPreco, "valor" | "retornoDias" | "retornoPercentual">, desde: string | null, agora: Date): { valor: number; retorno: CondicaoRetorno | null } {
  const cheio = Math.round(Number(preco.valor) * 100) / 100;
  const c = condicaoRetorno(preco);
  const t = desde ? Date.parse(desde) : NaN;
  const dentro = !!c && Number.isFinite(t) && agora.getTime() - t >= 0 && agora.getTime() - t <= c.dias * 86_400_000;
  return dentro ? { valor: Math.round(cheio * (100 - c!.percentual)) / 100, retorno: c } : { valor: cheio, retorno: null };
}

/** O que cada pedido cobra. A reverificação está no valor já pago (nunca cobra); a nova avaliação segue a regra acima. */
export function valorDoPedido(tipo: TipoPedido, preco: Pick<LinhaPreco, "valor" | "retornoDias" | "retornoPercentual">, desde: string | null, agora: Date): { valor: number; retorno: CondicaoRetorno | null } {
  if (tipo === "reverificacao") return { valor: 0, retorno: null };
  if (tipo === "nova_avaliacao") return valorNovaAvaliacao(preco, desde, agora);
  return { valor: Math.round(Number(preco.valor) * 100) / 100, retorno: null };
}

/** Texto ao dono da condição de retorno — só existe quando a condição existe. */
export function textoCondicaoRetorno(c: CondicaoRetorno | null): string | null {
  if (!c) return null;
  const pct = String(c.percentual).replace(".", ",");
  return `Nova avaliação em até ${c.dias} ${c.dias === 1 ? "dia" : "dias"} depois do resultado: ${pct}% de desconto sobre a tabela.`;
}

// ── Chave VISTORIA_ATIVA: as 3 condições para ligar (o admin mostra o estado de cada uma) ────────────────────────
export const MIN_AVALIADORES_ATIVOS = 2;

export interface CondicaoChave {
  id: "tabela" | "avaliadores" | "parecer";
  rotulo: string;
  ok: boolean;
  detalhe: string;
}

export function condicoesParaLigar(e: { tabelaCompleta: boolean; avaliadoresAtivos: number; parecerItem14: boolean }): CondicaoChave[] {
  return [
    { id: "tabela", rotulo: "Tabela de preço preenchida na cidade", ok: e.tabelaCompleta, detalhe: e.tabelaCompleta ? "Os 3 portes têm valor." : "tabela sem valor" },
    {
      id: "avaliadores",
      rotulo: `Pelo menos ${MIN_AVALIADORES_ATIVOS} avaliadores credenciados ativos na cidade`,
      ok: e.avaliadoresAtivos >= MIN_AVALIADORES_ATIVOS,
      detalhe: `${e.avaliadoresAtivos} ativo${e.avaliadoresAtivos === 1 ? "" : "s"}`,
    },
    { id: "parecer", rotulo: "Parecer do item 14 (Dra. Beatriz)", ok: e.parecerItem14, detalhe: e.parecerItem14 ? "Recebido." : "Pendente." },
  ];
}

/** O pedido abre? (chave ligada, anúncio publicado com o padrão mínimo e valor na tabela). */
export function pedidoPodeAbrir(e: { chaveAtiva: boolean; anuncioPublicado: boolean; preco: LinhaPreco | null }): { ok: true } | { ok: false; motivo: string } {
  if (!e.chaveAtiva) return { ok: false, motivo: "A avaliação do imóvel ainda não está disponível." };
  if (!e.anuncioPublicado) return { ok: false, motivo: "Publique o anúncio (com o padrão mínimo confirmado) antes de pedir a avaliação." };
  if (!e.preco) return { ok: false, motivo: "A avaliação ainda não tem valor nesta cidade." };
  return { ok: true };
}

// ── Credenciamento ─────────────────────────────────────────────────────────────────────────────────────────────
export const STATUS_CREDENCIAMENTO = ["solicitado", "em_teste", "ativo", "suspenso", "descredenciado"] as const;
export type StatusCredenciamento = (typeof STATUS_CREDENCIAMENTO)[number];

/** Código de conduta da avaliação (texto e versão registrados no aceite). */
export const CODIGO_CONDUTA = {
  versao: "2026-10-23",
  itens: [
    "Independência: avalio pelo checklist da Viva, sem combinar resultado com ninguém e sem aceitar nada além do valor da tabela.",
    "Declaro qualquer vínculo pessoal ou comercial com o proprietário ou o imóvel e não avalio onde houver vínculo.",
    "Sigilo: o que vejo no imóvel fica entre mim, o proprietário e a Viva.",
    "Minimização: fotografo só o necessário (1 por cômodo e 1 por item não conforme), sem pessoas e sem pertences do morador.",
    "Respeito o horário combinado e a concordância do morador quando o imóvel estiver ocupado.",
  ],
} as const;

/** Siglas das cidades (como os aeroportos); o resto usa as 3 primeiras letras. */
export const SIGLAS_CIDADE: Record<string, string> = {
  uberlandia: "UDI",
  "sao paulo": "SAO",
  "rio de janeiro": "RIO",
  "belo horizonte": "BHZ",
  brasilia: "BSB",
  goiania: "GYN",
  araguari: "ARG",
  uberaba: "UBA",
};

export function siglaCidade(cidade: string): string {
  const c = chaveCidade(cidade);
  return SIGLAS_CIDADE[c] ?? (c.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X") || "XXX");
}

/** Número de credenciado sequencial por cidade: UDI-001. */
export function numeroCredenciado(cidade: string, sequencia: number): string {
  return `${siglaCidade(cidade)}-${String(Math.max(1, Math.floor(sequencia))).padStart(3, "0")}`;
}

export interface CredenciamentoEntrada {
  identidadeVerificada: boolean;
  documentoValido: boolean;
  experienciaArquivo: boolean;
  experienciaLink: string | null;
  aceiteConduta: boolean;
  cidade: string;
}

/** O que falta para pedir o credenciamento (vazio = pode pedir). */
export function faltaParaCredenciamento(e: CredenciamentoEntrada): string[] {
  const falta: string[] = [];
  if (!e.identidadeVerificada) falta.push("Verificar a identidade.");
  if (!e.documentoValido) falta.push("CPF ou CNPJ válido no cadastro de parceiro.");
  const link = (e.experienciaLink ?? "").trim();
  if (!e.experienciaArquivo && !/^https:\/\/\S+\.\S+/.test(link)) falta.push("Comprovar experiência (portfólio ou referência: arquivo ou link https).");
  if (!e.aceiteConduta) falta.push("Aceitar o código de conduta da avaliação.");
  if (!chaveCidade(e.cidade)) falta.push("Informar a cidade onde vai avaliar.");
  return falta;
}

/** Mudança de status permitida (e se exige admin com duas etapas). "em_teste" → "ativo" só por admin AAL2. */
export function transicaoCredenciamento(de: StatusCredenciamento, para: StatusCredenciamento): { ok: boolean; exigeAdminAal2: boolean } {
  const permitidas: Record<StatusCredenciamento, StatusCredenciamento[]> = {
    solicitado: ["em_teste", "descredenciado"],
    em_teste: ["ativo", "descredenciado"],
    ativo: ["suspenso", "descredenciado"],
    suspenso: ["ativo", "descredenciado"],
    descredenciado: [],
  };
  return { ok: permitidas[de].includes(para), exigeAdminAal2: true };
}

// ── Designação por rodízio (a Viva designa; o dono nunca escolhe) ──────────────────────────────────────────────
export const MESES_IMPEDIMENTO_SERVICO = 12;
export const HORAS_PARA_RESPONDER = 24;

export interface AvaliadorFila {
  id: string; // credenciamento
  userId: string;
  cidade: string;
  status: StatusCredenciamento;
  teste: boolean; // conta is_teste
  credenciadoEm: string;
  ultimaDesignacaoEm: string | null;
  relacoesDonos: string[]; // owner_id declarados
  relacoesImoveis: string[]; // property_id declarados
}

/** "nova_90d" ficou só nos pedidos antigos (antes do adendo 62-B1); os novos usam "nova_avaliacao". */
export type TipoPedido = "inicial" | "reverificacao" | "contestacao" | "verificacao" | "nova_avaliacao" | "nova_90d";

export interface PedidoParaDesignar {
  id: string;
  propertyId: string;
  ownerId: string;
  cidade: string;
  tipo: TipoPedido;
  /** Imóvel de teste (is_teste): só avaliador em teste ou de teste avalia; contas reais ficam fora. */
  teste: boolean;
  /** Na contestação: quem fez a 1ª avaliação (impedido). */
  primeiroAvaliadorId: string | null;
  /** Já designados neste pedido (recusaram, não responderam ou faltaram). */
  jaDesignados: string[];
}

export interface HistoricoDesignacao {
  /** Serviços prestados (qualquer, de qualquer tabela) pelo usuário do avaliador ao dono: { userId, ownerId, em }. */
  servicosAoDono: { userId: string; ownerId: string; em: string }[];
  /** Avaliações deste imóvel, da mais antiga à mais recente: { avaliadorId, em }. */
  avaliacoesDoImovel: { avaliadorId: string; em: string }[];
}

export type MotivoImpedimento = "servico_12_meses" | "relacao_declarada" | "avaliacao_anterior" | "suspenso" | "primeira_da_contestacao" | "ja_designado" | "outra_cidade" | "nao_ativo" | "conta_teste";

export const ROTULO_IMPEDIMENTO: Record<MotivoImpedimento, string> = {
  servico_12_meses: "prestou serviço a este proprietário nos últimos 12 meses",
  relacao_declarada: "tem relação declarada com o proprietário ou o imóvel",
  avaliacao_anterior: "fez a avaliação anterior deste imóvel",
  suspenso: "está suspenso",
  primeira_da_contestacao: "fez a 1ª avaliação (contestação)",
  ja_designado: "já foi designado neste pedido",
  outra_cidade: "atende outra cidade",
  nao_ativo: "não está ativo",
  conta_teste: "conta de teste fora do rodízio real",
};

const MES = 30.4375 * 86_400_000;

/** Por que este avaliador não pode avaliar este pedido (null = pode). Ordem: o motivo mais forte primeiro. */
export function impedimento(a: AvaliadorFila, p: PedidoParaDesignar, h: HistoricoDesignacao, agora: Date): MotivoImpedimento | null {
  if (chaveCidade(a.cidade) !== chaveCidade(p.cidade)) return "outra_cidade";
  if (a.status === "suspenso") return "suspenso";
  // Imóvel de teste: a avaliação de TESTE do credenciamento (em_teste) e contas de teste; imóvel real: só ativos reais.
  if (p.teste ? !(a.status === "ativo" || a.status === "em_teste") : a.status !== "ativo") return "nao_ativo";
  if (!p.teste && a.teste) return "conta_teste";
  if (p.jaDesignados.includes(a.id)) return "ja_designado";
  if (p.tipo === "contestacao" && p.primeiroAvaliadorId === a.id) return "primeira_da_contestacao";
  const ultima = h.avaliacoesDoImovel.at(-1);
  if (ultima && ultima.avaliadorId === a.id) return "avaliacao_anterior";
  if (a.relacoesDonos.includes(p.ownerId) || a.relacoesImoveis.includes(p.propertyId)) return "relacao_declarada";
  const limite = agora.getTime() - MESES_IMPEDIMENTO_SERVICO * MES;
  if (h.servicosAoDono.some((s) => s.userId === a.userId && s.ownerId === p.ownerId && Date.parse(s.em) >= limite)) return "servico_12_meses";
  return null;
}

export type ResultadoDesignacao =
  | { avaliador: AvaliadorFila; impedidos: { id: string; motivo: MotivoImpedimento }[] }
  | { avaliador: null; motivo: "nenhum_elegivel"; impedidos: { id: string; motivo: MotivoImpedimento }[] };

/**
 * O próximo da fila da cidade, em rodízio justo: quem está há mais tempo sem designação primeiro (nunca designado vem
 * antes), desempate por quem se credenciou antes e pelo id. Impedidos ficam de fora com o motivo.
 */
export function proximoAvaliador(fila: AvaliadorFila[], pedido: PedidoParaDesignar, historico: HistoricoDesignacao, agora: Date): ResultadoDesignacao {
  const impedidos: { id: string; motivo: MotivoImpedimento }[] = [];
  const elegiveis: AvaliadorFila[] = [];
  for (const a of fila) {
    const m = impedimento(a, pedido, historico, agora);
    if (m) {
      if (m !== "outra_cidade") impedidos.push({ id: a.id, motivo: m });
    } else elegiveis.push(a);
  }
  const t = (s: string | null) => (s ? Date.parse(s) : -Infinity);
  elegiveis.sort((x, y) => t(x.ultimaDesignacaoEm) - t(y.ultimaDesignacaoEm) || Date.parse(x.credenciadoEm) - Date.parse(y.credenciadoEm) || x.id.localeCompare(y.id));
  return elegiveis[0] ? { avaliador: elegiveis[0], impedidos } : { avaliador: null, motivo: "nenhum_elegivel", impedidos };
}

/** A designação venceu sem resposta (24 h)? Recusa ou silêncio passam ao próximo da fila. */
export function designacaoVencida(designadoEm: string, agora: Date): boolean {
  return agora.getTime() - Date.parse(designadoEm) >= HORAS_PARA_RESPONDER * 3_600_000;
}

// ── Agenda e ausência (proposta do coordenador; o Daniel confirma antes de ligar a chave) ───────────────────────
export const REGRAS_AGENDA = {
  antecedenciaReagendarHoras: 24,
  reagendamentosPorParte: 1,
  ausenciasParaSuspender: 2,
  janelaAusenciasDias: 90,
} as const;

export type Parte = "dono" | "avaliador";

export function podeReagendar(agendadoPara: string, agora: Date, jaReagendou: boolean): { ok: true } | { ok: false; motivo: string } {
  if (jaReagendou) return { ok: false, motivo: "Cada parte pode reagendar uma vez sem custo." };
  if (Date.parse(agendadoPara) - agora.getTime() < REGRAS_AGENDA.antecedenciaReagendarHoras * 3_600_000) {
    return { ok: false, motivo: "Reagendar sem custo só com pelo menos 24 horas de aviso." };
  }
  return { ok: true };
}

/** Ausência: do dono/morador = novo pedido pela tabela; do avaliador = nova designação com prioridade, sem custo ao dono. */
export function consequenciaAusencia(quem: "dono" | "morador" | "avaliador"): { novoPedidoPelaTabela: boolean; redesignarComPrioridade: boolean; custoAoDono: boolean } {
  return quem === "avaliador" ? { novoPedidoPelaTabela: false, redesignarComPrioridade: true, custoAoDono: false } : { novoPedidoPelaTabela: true, redesignarComPrioridade: false, custoAoDono: true };
}

/** 2 ausências do avaliador em 90 dias → suspensão automática (o admin revê). */
export function suspendePorAusencias(ausencias: string[], agora: Date): boolean {
  const limite = agora.getTime() - REGRAS_AGENDA.janelaAusenciasDias * 86_400_000;
  return ausencias.filter((d) => Date.parse(d) >= limite).length >= REGRAS_AGENDA.ausenciasParaSuspender;
}

/** Lembrete D-1: a visita é amanhã (no dia civil de Brasília). */
export function visitaAmanha(agendadoPara: string, hojeBrasilia: string): boolean {
  const d = new Date(Date.parse(`${hojeBrasilia}T12:00:00-03:00`) + 86_400_000).toISOString().slice(0, 10);
  const alvo = new Date(Date.parse(agendadoPara) - 3 * 3_600_000).toISOString().slice(0, 10);
  return alvo === d;
}

// ── Avaliação mútua: só CONDUTA, nunca o resultado ─────────────────────────────────────────────────────────────
export const CONDUTA_DONO = ["pontualidade", "cordialidade", "cuidado"] as const; // o dono avalia o avaliador
export const CONDUTA_AVALIADOR = ["imovel_pronto", "horario_respeitado"] as const; // o avaliador avalia o acesso
export const ROTULO_CONDUTA: Record<string, string> = {
  pontualidade: "Pontualidade",
  cordialidade: "Cordialidade",
  cuidado: "Cuidado com o imóvel",
  imovel_pronto: "Imóvel pronto para a visita",
  horario_respeitado: "Horário respeitado",
};
export const CONDUTA_TEXTO_MAX = 300;

/** Palavras que citam o resultado: o texto da conduta não pode falar dele. */
const CITA_RESULTADO = /\b(aprov\w*|reprov\w*|ressalv\w*|resultado|laudo|n[ií]vel|premium|essencial|conforto|nota do im[oó]vel|vistoriad\w*)\b/i;

export function textoCitaResultado(texto: string): boolean {
  return CITA_RESULTADO.test(texto);
}

export function validarConduta(
  autor: "dono" | "avaliador",
  notas: Record<string, unknown>,
  texto: string | null | undefined,
  contemContato: (t: string) => boolean,
): { ok: true; notas: Record<string, number>; texto: string | null } | { ok: false; erro: string } {
  const campos: readonly string[] = autor === "dono" ? CONDUTA_DONO : CONDUTA_AVALIADOR;
  const extras = Object.keys(notas).filter((k) => !campos.includes(k));
  if (extras.length) return { ok: false, erro: "Só os itens de conduta podem ser avaliados." };
  const saida: Record<string, number> = {};
  for (const c of campos) {
    const n = Number(notas[c]);
    if (!Number.isInteger(n) || n < 1 || n > 5) return { ok: false, erro: `Dê uma nota de 1 a 5 para "${ROTULO_CONDUTA[c]}".` };
    saida[c] = n;
  }
  const t = String(texto ?? "").replace(/\s+/g, " ").trim().slice(0, CONDUTA_TEXTO_MAX);
  if (t && textoCitaResultado(t)) return { ok: false, erro: "Fale só da conduta na visita, não do resultado da avaliação." };
  if (t && contemContato(t)) return { ok: false, erro: "O texto não pode ter telefone, e-mail ou link." };
  return { ok: true, notas: saida, texto: t || null };
}

/** Nota de CONDUTA do avaliador (média das avaliações dos donos, 1 casa) — o que a página pública mostra. */
export function notaConduta(avaliacoes: Record<string, number>[]): number | null {
  const notas = avaliacoes.flatMap((a) => CONDUTA_DONO.map((c) => a[c]).filter((n): n is number => typeof n === "number"));
  return notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : null;
}

// ── Auditoria (fração interna, nunca exibida) ──────────────────────────────────────────────────────────────────
export const FRACAO_AUDITORIA = 0.1;
export const NAO_CONFERE_PARA_PROPOR = 2;

/** Sorteio estável por pedido (FNV-1a): o mesmo pedido dá sempre o mesmo resultado. */
export function sorteadoParaAuditoria(pedidoId: string, fracao = FRACAO_AUDITORIA): boolean {
  let h = 0x811c9dc5;
  for (let i = 0; i < pedidoId.length; i++) {
    h ^= pedidoId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0x1_0000_0000 < fracao;
}

/** 2 "não confere" em 12 meses → proposta de descredenciamento na fila do admin (decisão humana, AAL2). */
export function propoeDescredenciamento(revisoes: { resultado: "confere" | "nao_confere"; em: string }[], agora: Date): boolean {
  const limite = agora.getTime() - 12 * MES;
  return revisoes.filter((r) => r.resultado === "nao_confere" && Date.parse(r.em) >= limite).length >= NAO_CONFERE_PARA_PROPOR;
}

// ── Visibilidade ───────────────────────────────────────────────────────────────────────────────────────────────
/** Dono e morador só veem algo da avaliação com a chave ligada. Credenciamento e admin funcionam sempre. */
export function avaliacaoVisivel(papel: "dono" | "morador" | "avaliador" | "admin", chaveAtiva: boolean): boolean {
  return papel === "avaliador" || papel === "admin" || chaveAtiva;
}
