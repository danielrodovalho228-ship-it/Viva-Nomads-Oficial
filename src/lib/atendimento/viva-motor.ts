/*
  Assistente Viva — o motor (PURO). Recebe o modelo e as ferramentas de fora:
  no servidor, a API da Anthropic e o banco filtrado pelo dono do chamado; nos
  testes, um modelo simulado. Ordem fixa:
    1) `rotear` decide em código (emergência, P1, pessoa, contato, aprovação…);
    2) só a rota "ia" (e a preparação da aprovação) chamam o modelo;
    3) a resposta passa por `validarResposta`; se falhar, vai para uma pessoa.
*/
import { frasePrazo, type Prioridade, type UrgenciaManutencao } from "../../config/atendimento.ts";
import {
  abertura,
  ehGolpe,
  RESPOSTA_APROVACAO,
  RESPOSTA_CONTATO,
  RESPOSTA_FALHA,
  RESPOSTA_GOLPE,
  RESPOSTA_PESSOA,
  rotear,
  tentativaInjecao,
  validarResposta,
  type Rota,
  type TipoAprovacao,
} from "./viva-regras.ts";
import { FERRAMENTAS_ACAO, FERRAMENTAS_DESTINO, FERRAMENTAS_LEITURA, FERRAMENTAS_VIVA, SYSTEM_VIVA, type FerramentaDef } from "./viva-prompt.ts";

/** O mínimo da resposta do Messages API que o motor lê (a resposta do SDK cabe aqui). */
export interface BlocoModelo {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}
export interface RespostaModelo {
  stop_reason: string | null;
  content: BlocoModelo[];
  usage?: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };
}
export interface MensagemModelo {
  role: "user" | "assistant";
  content: string | unknown[];
}
export type ChamarModelo = (req: { system: string; tools: FerramentaDef[]; messages: MensagemModelo[] }) => Promise<RespostaModelo>;

export interface Aprovacao {
  tipo: TipoAprovacao | null;
  resumo: string;
  provas: string[];
  resposta_sugerida: string;
  acao_sugerida: string;
}

export type Efeito =
  | ({ tipo: "aprovacao" } & Omit<Aprovacao, "tipo">)
  | { tipo: "escalar"; motivo: string }
  | { tipo: "manutencao"; urgencia: UrgenciaManutencao; serviceOrderId: string };

export interface ResultadoFerramenta {
  conteudo: string;
  efeito?: Efeito;
  erro?: boolean;
}
export type Ferramentas = Partial<Record<string, (input: Record<string, unknown>) => Promise<ResultadoFerramenta>>>;

export interface EntradaViva {
  /** Mensagem atual da pessoa. */
  texto: string;
  categoria: string;
  nome: string | null;
  /** Texto de contexto do chamado (contextoChamado). */
  contexto: string;
  /** Mensagens públicas ANTERIORES à atual. */
  historico: { autor: "usuario" | "ia" | "admin" | "sistema"; corpo: string }[];
  respostasIA: number;
  prioridade: Prioridade;
  temContratoAtivo: boolean;
  iaDisponivel: boolean;
  agora: Date;
}

export type Destino = "ia" | "humano" | "aprovacao";

export interface ResultadoViva {
  rota: Rota;
  motivo: string;
  /** Texto para a pessoa (autor "ia"). null = nada a dizer além do que o sistema já disse. */
  resposta: string | null;
  destino: Destino;
  prioridade: Prioridade;
  aprovacao: Aprovacao | null;
  manutencao: { urgencia: UrgenciaManutencao; serviceOrderId: string } | null;
  /** Ferramentas consultadas (fontes) e ações feitas. */
  fontes: string[];
  acoes: string[];
  /** Por que a resposta da IA foi barrada (vai para a nota interna). */
  bloqueio: string | null;
  uso: { chamadas: number; entrada: number; saida: number; cacheLida: number; cacheEscrita: number };
}

const ORDEM: Prioridade[] = ["p1", "p2", "p3", "p4"];
export function maisUrgente(a: Prioridade, b: Prioridade): Prioridade {
  return ORDEM.indexOf(a) <= ORDEM.indexOf(b) ? a : b;
}

const MAX_VOLTAS = 4;
const ROTULO_AUTOR = { usuario: "Pessoa", ia: "Viva", admin: "Equipe", sistema: "Sistema" } as const;

function transcricao(e: EntradaViva): string {
  const anteriores = e.historico
    .slice(-12)
    .map((m) => `${ROTULO_AUTOR[m.autor]}: ${m.corpo.slice(0, 1200)}`)
    .join("\n");
  return [
    "<contexto_do_chamado>",
    e.contexto,
    "</contexto_do_chamado>",
    anteriores ? `<conversa_anterior>\n${anteriores}\n</conversa_anterior>` : "",
    "<mensagem_atual_da_pessoa>",
    e.texto.slice(0, 4000),
    "</mensagem_atual_da_pessoa>",
    "Responda à mensagem atual seguindo as regras. Use as ferramentas quando precisar de dados da pessoa.",
  ]
    .filter(Boolean)
    .join("\n");
}

function base(e: EntradaViva, rota: Rota, motivo: string): ResultadoViva {
  return {
    rota,
    motivo,
    resposta: null,
    destino: "humano",
    prioridade: e.prioridade,
    aprovacao: null,
    manutencao: null,
    fontes: [],
    acoes: tentativaInjecao(e.texto) ? ["tentativa_injecao"] : [],
    bloqueio: null,
    uso: { chamadas: 0, entrada: 0, saida: 0, cacheLida: 0, cacheEscrita: 0 },
  };
}

function comAbertura(e: EntradaViva, texto: string): string {
  return e.respostasIA === 0 ? `${abertura(e.nome)}\n\n${texto}` : texto;
}

/** Atende uma mensagem. Nunca lança: qualquer falha vira "passar para uma pessoa". */
export async function atenderViva(e: EntradaViva, modelo: ChamarModelo | null, ferramentas: Ferramentas): Promise<ResultadoViva> {
  const d = rotear(e.texto, { categoria: e.categoria, temContratoAtivo: e.temContratoAtivo, respostasIA: e.respostasIA });
  const r = base(e, d.rota, d.motivo);

  switch (d.rota) {
    case "emergencia":
      // O aviso 193/190 já é a primeira mensagem do sistema; aqui só P1 + pessoa.
      return { ...r, prioridade: "p1" };
    case "p1":
      return { ...r, prioridade: "p1", resposta: ehGolpe(e.texto) ? RESPOSTA_GOLPE : null };
    case "humano": {
      const prioridade = d.motivo === "assunto de dinheiro" ? maisUrgente(e.prioridade, "p2") : e.prioridade;
      return { ...r, prioridade, resposta: `${RESPOSTA_PESSOA} ${frasePrazo(prioridade, e.agora)}` };
    }
    case "contato":
      return { ...r, destino: "ia", resposta: comAbertura(e, RESPOSTA_CONTATO) };
    case "aprovacao":
    case "ia":
      break;
  }

  const aprovacaoPadrao = (): Aprovacao => ({
    tipo: d.aprovacao ?? null,
    resumo: e.texto.slice(0, 600),
    provas: [],
    resposta_sugerida: "",
    acao_sugerida: "Analisar o pedido e responder a pessoa.",
  });
  const fecharAprovacao = (ap: Aprovacao): ResultadoViva => {
    const prioridade = maisUrgente(e.prioridade, "p2");
    return { ...r, destino: "aprovacao", prioridade, aprovacao: ap, resposta: comAbertura(e, `${RESPOSTA_APROVACAO} ${frasePrazo(prioridade, e.agora)}`) };
  };

  if (!e.iaDisponivel || !modelo) {
    // Sem IA: aprovação vai direto para a fila; o resto fica com a equipe (PR 1).
    return d.rota === "aprovacao" ? fecharAprovacao(aprovacaoPadrao()) : { ...r, motivo: "IA desligada" };
  }

  const permitidas = new Set<string>(
    d.rota === "aprovacao" ? [...FERRAMENTAS_LEITURA, ...FERRAMENTAS_DESTINO] : [...FERRAMENTAS_LEITURA, ...FERRAMENTAS_ACAO, ...FERRAMENTAS_DESTINO]
  );
  const tools = FERRAMENTAS_VIVA.filter((t) => permitidas.has(t.name));
  const mensagens: MensagemModelo[] = [
    {
      role: "user",
      content:
        transcricao(e) +
        (d.rota === "aprovacao"
          ? `\nEste pedido é do tipo "${d.motivo}" e vai para a aprovação do Daniel. Junte os fatos com as ferramentas de consulta e chame preparar_para_aprovacao.`
          : ""),
    },
  ];

  let manutencao: ResultadoViva["manutencao"] = null;
  let prioridade = e.prioridade;
  const fontes: string[] = [];
  const acoes = [...r.acoes];

  try {
    for (let volta = 0; volta < MAX_VOLTAS; volta++) {
      const resp = await modelo({ system: SYSTEM_VIVA, tools, messages: mensagens });
      r.uso.chamadas++;
      r.uso.entrada += resp.usage?.input_tokens ?? 0;
      r.uso.saida += resp.usage?.output_tokens ?? 0;
      r.uso.cacheLida += resp.usage?.cache_read_input_tokens ?? 0;
      r.uso.cacheEscrita += resp.usage?.cache_creation_input_tokens ?? 0;

      if (resp.stop_reason === "refusal" || resp.stop_reason === "max_tokens") {
        return { ...r, fontes, acoes, manutencao, prioridade, resposta: RESPOSTA_FALHA, bloqueio: `modelo parou (${resp.stop_reason})` };
      }
      const usos = resp.content.filter((b) => b.type === "tool_use" && b.id && b.name);
      if (usos.length === 0) {
        const texto = resp.content
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("\n")
          .trim();
        if (d.rota === "aprovacao") return { ...fecharAprovacao(aprovacaoPadrao()), fontes, acoes, uso: r.uso };
        const conf = validarResposta(texto);
        if (!conf.ok) return { ...r, fontes, acoes, manutencao, prioridade, resposta: RESPOSTA_FALHA, bloqueio: conf.motivo ?? "resposta barrada" };
        return { ...r, destino: "ia", fontes, acoes, manutencao, prioridade, resposta: comAbertura(e, conf.texto) };
      }

      mensagens.push({ role: "assistant", content: resp.content });
      const resultados: unknown[] = [];
      let destino: Efeito | null = null;
      for (const u of usos) {
        const nome = u.name as string;
        const input = (u.input && typeof u.input === "object" ? u.input : {}) as Record<string, unknown>;
        const exec = permitidas.has(nome) ? ferramentas[nome] : undefined;
        let res: ResultadoFerramenta;
        if (!exec) res = { conteudo: "Ferramenta não disponível para este pedido.", erro: true };
        else {
          try {
            res = await exec(input);
          } catch {
            res = { conteudo: "Não foi possível consultar agora.", erro: true };
          }
        }
        if (!res.erro) {
          if ((FERRAMENTAS_LEITURA as readonly string[]).includes(nome)) fontes.push(nome);
          if ((FERRAMENTAS_ACAO as readonly string[]).includes(nome)) acoes.push(nome);
        }
        if (res.efeito?.tipo === "manutencao") {
          manutencao = { urgencia: res.efeito.urgencia, serviceOrderId: res.efeito.serviceOrderId };
          prioridade = maisUrgente(prioridade, res.efeito.urgencia === "urgente" ? "p2" : "p3");
        } else if (res.efeito) destino = destino ?? res.efeito;
        resultados.push({ type: "tool_result", tool_use_id: u.id, content: res.conteudo.slice(0, 6000), ...(res.erro ? { is_error: true } : {}) });
      }
      if (destino?.tipo === "aprovacao") {
        const { tipo: _t, ...resto } = destino;
        void _t;
        return { ...fecharAprovacao({ tipo: d.aprovacao ?? null, ...resto }), fontes, acoes, uso: r.uso };
      }
      if (destino?.tipo === "escalar") {
        return { ...r, fontes, acoes, manutencao, prioridade, motivo: destino.motivo, resposta: `${RESPOSTA_PESSOA} ${frasePrazo(prioridade, e.agora)}` };
      }
      mensagens.push({ role: "user", content: resultados });
    }
  } catch {
    return { ...r, fontes, acoes, manutencao, prioridade, resposta: RESPOSTA_FALHA, bloqueio: "falha ao chamar a IA" };
  }
  if (d.rota === "aprovacao") return { ...fecharAprovacao(aprovacaoPadrao()), fontes, acoes, uso: r.uso };
  return { ...r, fontes, acoes, manutencao, prioridade, resposta: RESPOSTA_FALHA, bloqueio: "a IA não concluiu em 4 voltas" };
}
