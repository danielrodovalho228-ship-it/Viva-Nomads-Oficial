/*
  E375-B — RESUMO SEMANAL de recomendações (decisão do Daniel, 01/11). PURO.
    • Sai às TERÇAS (dia de Brasília), dentro do disparo diário /api/cron/resumo-pedidos, com a chave
      RESUMO_SEMANAL_ATIVO ligada (nasce desligada em produção).
    • Para o morador com pedido ativo ou busca salva com alerta (nunca pela navegação).
    • Duas seções, até 3 cartões cada e "ver os N":
        (a) imóveis publicados nos últimos 7 dias que combinam (a mesma regra do pedido e do alerta de busca), mais os
            pendentes da fila dos proativos (E264-B) que ainda valem — esses saem AQUI e ficam marcados como enviados;
        (b) "Baixou o valor": favoritos cujo total por mês caiu na semana (quedas_preco).
    • Sem repetição: imóvel que já saiu para a pessoa em qualquer e-mail proativo não entra em (a); em (b) a mesma queda
      nunca sai duas vezes. Sem item, não sai e-mail.
    • É um proativo: conta no teto (1 por dia, 3 em 7 dias) e respeita o silêncio; se não couber, não sai na semana.
    • O motivo de cada cartão só usa fatos reais do casamento (nada inventado).
  Roda: node --test src/lib/notifications/resumo-semanal.test.ts
*/
import { comMarca, ASSUNTO_MAX } from "./assuntos.ts";
import { diaBrasilia } from "./proativos.ts";

export const EVENTO_RESUMO = "resumo_semanal" as const;
/** Cartões por seção; o resto vira "ver os N". */
export const CARTOES_POR_SECAO = 3;
/** Janela dos "novos" e das quedas. */
export const JANELA_DIAS = 7;

/** Terça-feira no dia de Brasília (0 = domingo). */
export function ehTercaEmBrasilia(agora: Date): boolean {
  return new Date(`${diaBrasilia(agora)}T12:00:00Z`).getUTCDay() === 2;
}

/** O resumo roda hoje? Chave ligada e terça em Brasília (o botão do QA ignora os dois: só contas de teste). */
export function resumoRodaHoje(agora: Date, chaveLigada: boolean): boolean {
  return chaveLigada && ehTercaEmBrasilia(agora);
}

/** Início da janela de 7 dias (ISO), para "publicados" e "quedas". */
export function inicioDaJanela(agora: Date, dias = JANELA_DIAS): string {
  return new Date(agora.getTime() - dias * 86_400_000).toISOString();
}

export type OrigemNovo = "pedido" | "busca";
/** De onde vieram os novos do e-mail (para o assunto e o título da seção dizerem só a verdade). */
export type OrigemDoResumo = OrigemNovo | "ambos";

export function origemDoResumo(novos: readonly Pick<CandidatoNovo, "origem">[]): OrigemDoResumo {
  const o = new Set(novos.map((n) => n.origem));
  return o.size === 2 ? "ambos" : o.has("busca") ? "busca" : "pedido";
}

/** "para o seu pedido" · "para a sua busca" · "para você". */
export function paraQuem(origem: OrigemDoResumo): string {
  return origem === "pedido" ? "o seu pedido" : origem === "busca" ? "a sua busca" : "você";
}

export interface CandidatoNovo {
  imovelId: string;
  origem: OrigemNovo;
  /** Fatos reais do casamento, já em frase (motivoDoPedido / motivoDaBusca). */
  motivo: string;
  cidade?: string | null;
  /** Linha pendente da fila (E264-B) que este cartão absorve. */
  linhaFila?: string | null;
}

export interface CandidatoQueda {
  imovelId: string;
  quedaId: string;
  totalAntigo: number;
  totalNovo: number;
  registradaEm: string;
}

export interface SelecaoResumo {
  novos: CandidatoNovo[];
  baixas: CandidatoQueda[];
  /** Linhas pendentes da fila que saem neste resumo (marcadas como enviadas com o envio_id dele). */
  filaAbsorvida: string[];
}

/**
 * O que entra no resumo da pessoa.
 *  • novos: candidatos (pedido/busca) + pendentes da fila; um cartão por imóvel; fora o que JÁ SAIU para a pessoa em
 *    qualquer e-mail proativo (`jaEnviados`). O pedido vem antes da busca; o pendente da fila mais antigo antes.
 *  • baixas: a queda mais recente de cada favorito; fora a queda que já saiu (`quedasJaEnviadas`) e o imóvel que já está
 *    em "novos" (um cartão por imóvel no e-mail).
 */
export function selecionarResumo(o: {
  candidatos: readonly CandidatoNovo[];
  pendentesFila: readonly CandidatoNovo[];
  quedas: readonly CandidatoQueda[];
  jaEnviados: ReadonlySet<string>;
  quedasJaEnviadas: ReadonlySet<string>;
}): SelecaoResumo {
  const novos: CandidatoNovo[] = [];
  const vistos = new Set<string>();
  const filaAbsorvida: string[] = [];
  const ordem = [...o.candidatos.filter((c) => c.origem === "pedido"), ...o.pendentesFila, ...o.candidatos.filter((c) => c.origem === "busca")];
  for (const c of ordem) {
    if (o.jaEnviados.has(c.imovelId)) continue;
    if (vistos.has(c.imovelId)) {
      // O mesmo imóvel da fila e de um candidato: um cartão só, e a linha da fila sai junto.
      if (c.linhaFila) filaAbsorvida.push(c.linhaFila);
      continue;
    }
    vistos.add(c.imovelId);
    novos.push(c);
    if (c.linhaFila) filaAbsorvida.push(c.linhaFila);
  }
  const porImovel = new Map<string, CandidatoQueda>();
  for (const q of [...o.quedas].sort((a, b) => Date.parse(b.registradaEm) - Date.parse(a.registradaEm))) {
    if (o.quedasJaEnviadas.has(q.quedaId) || vistos.has(q.imovelId) || porImovel.has(q.imovelId)) continue;
    if (!(q.totalNovo < q.totalAntigo)) continue;
    porImovel.set(q.imovelId, q);
  }
  return { novos, baixas: [...porImovel.values()], filaAbsorvida: [...new Set(filaAbsorvida)] };
}

/** Sem novidade, sem e-mail. */
export function temNovidade(s: SelecaoResumo): boolean {
  return s.novos.length + s.baixas.length > 0;
}

/** Chave da linha do resumo na fila: uma por (pessoa, imóvel, semana) — a queda leva o id dela (não repete). */
export function chaveResumo(usuarioId: string, imovelId: string, semana: string, quedaId?: string | null): string {
  return ["proativo", EVENTO_RESUMO, usuarioId, imovelId, quedaId ? `queda-${quedaId}` : semana].join(":");
}

// ── Motivo: só fatos reais do casamento ──────────────────────────────────────────────────────────────────────────

const brl = (v: number) => `R$ ${Math.round(Number(v) || 0).toLocaleString("pt-BR")}`;
const dataCurta = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : "";
};

/** Fatos do par pedido × imóvel (a linha da função do banco compatibilidade_pedidos). */
export interface FatosDoPedido {
  total_mensal: number;
  orcamento: number;
  vagas: number | null;
  ocupantes: number;
  entrada: string;
  disponivel_desde: string | null;
  cidade?: string | null;
}

/** "Combina com o seu pedido: R$ 3.350 por mês, dentro do seu limite de R$ 4.000; para 2 pessoas; livre na sua entrada em 15/12." */
export function motivoDoPedido(f: FatosDoPedido): string {
  const partes: string[] = [];
  if (f.total_mensal > 0 && f.orcamento > 0 && f.total_mensal <= f.orcamento) partes.push(`${brl(f.total_mensal)} por mês, dentro do seu limite de ${brl(f.orcamento)}`);
  if (f.vagas != null && f.ocupantes > 0 && f.vagas >= f.ocupantes) partes.push(`para ${f.ocupantes} ${f.ocupantes === 1 ? "pessoa" : "pessoas"}`);
  const entrada = dataCurta(f.entrada);
  if (entrada) {
    const livre = f.disponivel_desde ? dataCurta(f.disponivel_desde) : "";
    if (!f.disponivel_desde || f.disponivel_desde <= f.entrada) partes.push(livre && f.disponivel_desde! < f.entrada ? `livre desde ${livre}, antes da sua entrada em ${entrada}` : `livre na sua entrada em ${entrada}`);
  }
  return partes.length ? `Combina com o seu pedido: ${partes.join("; ")}.` : "Combina com o seu pedido de moradia.";
}

/** O que a busca pediu e o imóvel tem (só critérios que a busca usou E o imóvel cumpre). */
export interface FatosDaBusca {
  /** Texto "local" da busca (cidade ou bairro), quando havia. */
  local?: string | null;
  /** Limite de preço da busca e o total por mês do imóvel. */
  limite?: number | null;
  totalMes?: number | null;
  /** Quartos mínimos da busca e os do imóvel. */
  quartosMin?: number | null;
  quartos?: number | null;
  /** A busca pediu pet e o imóvel aceita. */
  pet?: boolean;
}

/**
 * Os fatos da busca salva que o imóvel cumpre, lidos da MESMA query string do alerta (imovelBateComBusca): o local
 * digitado, o limite de preço (orcamento/preco), os quartos mínimos e o pet. `preco` é o preço que a busca compara
 * (precoDeBusca). Critério que a busca não usou, ou que o imóvel não cumpre, não entra.
 */
export function fatosDaBusca(parametros: string, p: { preco: number; quartos?: number | null; aceitaPet?: boolean | null }): FatosDaBusca {
  const sp = new URLSearchParams(parametros);
  const num = (k: string) => Number(sp.get(k)) || 0;
  const limite = num("orcamento") || num("preco");
  const quartosMin = num("quartos");
  return {
    local: (sp.get("local") ?? "").split(/[,\-–]/)[0].trim() || null,
    limite: limite >= 300 && limite <= 50000 ? limite : null,
    totalMes: p.preco,
    quartosMin: [1, 2, 3].includes(quartosMin) ? quartosMin : null,
    quartos: p.quartos ?? null,
    pet: sp.get("pet") === "1" && p.aceitaPet === true,
  };
}

/** "Combina com a sua busca: em Santa Mônica; R$ 3.350 por mês, dentro do seu limite de R$ 3.500; 2 quartos." */
export function motivoDaBusca(f: FatosDaBusca): string {
  const partes: string[] = [];
  const local = (f.local ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (local) partes.push(`em ${local}`);
  if (f.limite && f.totalMes && f.totalMes > 0 && f.totalMes <= f.limite) partes.push(`${brl(f.totalMes)} por mês, dentro do seu limite de ${brl(f.limite)}`);
  if (f.quartosMin && f.quartos && f.quartos >= f.quartosMin) partes.push(`${f.quartos} ${f.quartos === 1 ? "quarto" : "quartos"}`);
  if (f.pet) partes.push("aceita pet");
  return partes.length ? `Combina com a sua busca: ${partes.join("; ")}.` : "Combina com a sua busca salva.";
}

/** "Baixou de R$ 3.550 para R$ 3.350 por mês." */
export function motivoDaQueda(q: Pick<CandidatoQueda, "totalAntigo" | "totalNovo">): string {
  return `Baixou de ${brl(q.totalAntigo)} para ${brl(q.totalNovo)} por mês.`;
}

// ── Assunto: a contagem real, com a marca e na régua de 70 ──────────────────────────────────────────────────────

/** A cidade comum dos cartões (vazia quando são cidades diferentes). */
export function cidadeComum(cidades: readonly (string | null | undefined)[]): string {
  const limpas = [...new Set(cidades.map((c) => (c ?? "").replace(/\s+/g, " ").trim()).filter(Boolean))];
  return limpas.length === 1 ? limpas[0] : "";
}

/**
 * "{primeiro nome}, {N} imóveis novos para o seu pedido em {cidade}" (contagem real; variantes para a busca e para a
 * baixa de valor). Sem o nome quando não há; sem a cidade quando não cabe na régua ou os cartões são de cidades
 * diferentes. Devolve SEM a marca (o notify põe "· Viva Nomads").
 */
export function assuntoResumo(o: { nome?: string | null; novos: number; origem: OrigemDoResumo; cidade?: string | null; baixas: number }): string {
  const nome = (o.nome ?? "").replace(/\s+/g, " ").trim().split(" ")[0] ?? "";
  let fato: string;
  let cidade = (o.cidade ?? "").trim();
  if (o.novos > 0) {
    const n = o.novos === 1 ? "1 imóvel novo" : `${o.novos} imóveis novos`;
    fato = `${n} para ${paraQuem(o.origem)}`;
  } else {
    fato = o.baixas === 1 ? "1 imóvel que você favoritou baixou de valor" : `${o.baixas} imóveis que você favoritou baixaram de valor`;
    cidade = "";
  }
  const cabe = (s: string) => comMarca(s).length <= ASSUNTO_MAX;
  const comNome = (s: string) => (nome ? `${nome}, ${s}` : `${s.charAt(0).toLocaleUpperCase("pt-BR")}${s.slice(1)}`);
  const formas = [cidade ? comNome(`${fato} em ${cidade}`) : "", comNome(fato), cidade ? `${fato} em ${cidade}` : "", fato].filter(Boolean);
  const escolhido = formas.find(cabe) ?? fato;
  return `${escolhido.charAt(0).toLocaleUpperCase("pt-BR")}${escolhido.slice(1)}`;
}

// ── Vocabulário da casa ──────────────────────────────────────────────────────────────────────────────────────────

/** Palavras que o resumo nunca usa (assunto e corpo). */
export const PALAVRAS_PROIBIDAS = ["aluguel", "comissão", "inquilino", "temporada"] as const;

/** As proibidas que aparecem no texto (vazio = aprovado). */
export function palavrasProibidas(texto: string): string[] {
  const t = texto.toLocaleLowerCase("pt-BR");
  return PALAVRAS_PROIBIDAS.filter((p) => t.includes(p));
}
