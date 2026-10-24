/*
  Prompt 62-A, Parte 1 — textos e regras de EXIBIÇÃO das telas da avaliação do imóvel do dono e do morador. PURO
  (node --test). As regras de negócio ficam em ./regras.ts (Pista B); aqui só o que a tela mostra. O credenciamento, a
  página pública do avaliador, a agenda do avaliador e o admin voltam depois do 62-B3 (caminho novo do credenciamento).
  Na tela: "avaliação do imóvel" e "avaliador credenciado". Nenhum número de ganho por nível; o dono não escolhe.
*/
import { ETIQUETA_BRASILIA, dataBRT, horaBRT } from "../datas-brasilia.ts";
import { chaveCidade } from "../cidades.ts";
import { HORAS_PARA_RESPONDER, ROTULO_IMPEDIMENTO, impedimento, type AvaliadorFila, type MotivoImpedimento, type StatusCredenciamento } from "./regras.ts";

// ── Data e hora da visita (QA do #1111, item 6: sem segundos e com o fuso) ─────────────────────────────────────
/** "25/10/2026 às 10:00" no horário de Brasília. */
export function quandoVisita(iso: string): string {
  return `${dataBRT(iso)} às ${horaBRT(iso)}`;
}
/** "25/10/2026 às 10:00, horário de Brasília". */
export function quandoVisitaComFuso(iso: string): string {
  return `${quandoVisita(iso)}, ${ETIQUETA_BRASILIA}`;
}

// ── Item 3: as duas rotas, lado a lado, no Nível do dono ─────────────────────────────────────────────────────
export const ROTAS_NIVEL = [
  { chave: "foto", titulo: "Foto: grátis, nível na hora", texto: "Envie a foto de cada item acima. O nível muda assim que a foto é aceita." },
  { chave: "avaliacao", titulo: "Avaliação: “· vistoriado” por 12 meses", texto: "Um avaliador credenciado visita o imóvel e confere tudo pelo checklist da Viva." },
] as const;
export const TITULO_BLOCO_DONO = "Avaliação do imóvel";

// ── Item 4: linha do tempo do pedido (pedido → designado nº X → agendado → realizada → laudo) ─────────────────
export type EstadoEtapa = "feito" | "atual" | "futuro";
export interface EtapaPedido {
  chave: "pedido" | "designado" | "agendado" | "realizada" | "laudo_emitido";
  rotulo: string;
  estado: EstadoEtapa;
}
const ORDEM_ETAPAS = ["pedido", "designado", "agendado", "realizada", "laudo_emitido"] as const;

export function linhaDoTempoPedido(p: { status: string; numero?: string | null; agendadoPara?: string | null; aguardandoAvaliador?: boolean }): EtapaPedido[] {
  const atual = Math.max(0, ORDEM_ETAPAS.indexOf(p.status as (typeof ORDEM_ETAPAS)[number]));
  const rotulo: Record<(typeof ORDEM_ETAPAS)[number], string> = {
    pedido: p.aguardandoAvaliador ? "Pedido · aguardando avaliador" : "Pedido",
    designado: p.numero ? `Designado nº ${p.numero}` : "Designado",
    agendado: p.agendadoPara ? `Agendado para ${quandoVisita(p.agendadoPara)}` : "Agendado",
    realizada: "Visita feita",
    laudo_emitido: "Laudo",
  };
  return ORDEM_ETAPAS.map((chave, i) => ({ chave, rotulo: rotulo[chave], estado: i < atual ? "feito" : i === atual ? "atual" : "futuro" }));
}

/**
 * A frase de situação do pedido do dono. "designado" não tem frase própria: a linha "Avaliador designado pela Viva: nº X"
 * já diz tudo (QA do #1111, item 5: a frase saía duas vezes).
 */
export function situacaoDono(p: { status: string; aguardandoAvaliador: boolean; ocupado: boolean; concordanciaEm: string | null; agendadoPara: string | null }): string | null {
  if (p.aguardandoAvaliador) return "Aguardando avaliador: a Viva avisa quando designar.";
  switch (p.status) {
    case "pedido":
      return "Pedido registrado: a Viva está designando o avaliador.";
    case "designado":
      return p.ocupado && p.agendadoPara && !p.concordanciaEm ? "Data proposta: a visita fica confirmada quando o morador concordar." : null;
    case "agendado":
      return "Visita confirmada.";
    case "realizada":
      return "Visita feita: o laudo sai em até 48 horas úteis.";
    default:
      return null;
  }
}

// ── Pagamento direto (texto do 31b; a plataforma só registra) ─────────────────────────────────────────────────
export function situacaoPagamento(p: { recebidoMarcadoEm: string | null; recebidoConfirmadoEm: string | null }): string {
  if (p.recebidoConfirmadoEm) return "Pagamento registrado pelos dois lados.";
  if (p.recebidoMarcadoEm) return "O avaliador marcou o valor como recebido. Confirme se você já pagou.";
  return "Você paga direto ao avaliador, depois da visita. A Viva só registra.";
}

// ── Item 1: credenciamento (pedido único do 62-B3) — passos e estado ────────────────────────────────────────────
export const PASSOS_CREDENCIAMENTO = [
  { chave: "identidade", rotulo: "Identidade verificada" },
  { chave: "experiencia", rotulo: "Experiência comprovada" },
  { chave: "conduta", rotulo: "Código de conduta aceito" },
  { chave: "relacoes", rotulo: "Relações declaradas" },
  { chave: "teste", rotulo: "Avaliação de teste revisada pela Viva" },
] as const;
export type ChavePasso = (typeof PASSOS_CREDENCIAMENTO)[number]["chave"];

export const ESTADO_CREDENCIAMENTO: Record<StatusCredenciamento, string> = {
  solicitado: "Em análise",
  em_teste: "Em teste",
  ativo: "Ativo",
  suspenso: "Suspenso",
  descredenciado: "Descredenciado",
};

/**
 * O que já está cumprido. Experiência, conduta e relações vão no pedido; a identidade vem só do FATO (verificação
 * confirmada) — E35-B: ela é requisito da ativação, não do teste, então o status não a implica; o teste só conta revisado.
 */
export function passosCumpridos(e: { status: StatusCredenciamento | null; identidadeVerificada: boolean; testeConcluido: boolean }): Record<ChavePasso, boolean> {
  const enviado = e.status !== null;
  // E30: o passo 5 só conta com a avaliação de teste REGISTRADA (laudo emitido) e revisada (ativação) — nunca pelo
  // status sozinho (a massa de teste chegou a "Ativo" sem avaliação nenhuma).
  return { identidade: e.identidadeVerificada, experiencia: enviado, conduta: enviado, relacoes: enviado, teste: e.testeConcluido && (e.status === "ativo" || e.status === "suspenso") };
}

// ── Item 2: página pública ───────────────────────────────────────────────────────────────────────────────────
export const LINHA_PUBLICA_DESIGNACAO = "A Viva designa o avaliador. O proprietário não escolhe.";

// ── Item 6: agenda do avaliador ───────────────────────────────────────────────────────────────────────────────
/** O contador das 24 h para aceitar: "Responda em 23 h 10 min". Vencido: passa ao próximo (a rotina faz). */
export function prazoResposta(designadoEm: string, agora: Date): { vencido: boolean; texto: string } {
  const resta = Date.parse(designadoEm) + HORAS_PARA_RESPONDER * 3_600_000 - agora.getTime();
  if (resta <= 0) return { vencido: true, texto: "Prazo de resposta vencido: o pedido passa ao próximo avaliador." };
  const h = Math.floor(resta / 3_600_000);
  const m = Math.floor((resta % 3_600_000) / 60_000);
  return { vencido: false, texto: `Responda em ${h} h ${String(m).padStart(2, "0")} min` };
}

/** A visita cai nos próximos 7 dias (a "semana" da agenda)? */
export function visitaNaSemana(agendadoPara: string | null, agora: Date): boolean {
  if (!agendadoPara) return false;
  const t = Date.parse(agendadoPara) - agora.getTime();
  return t >= -12 * 3_600_000 && t <= 7 * 86_400_000;
}

// ── Item 7: admin "Avaliações do imóvel" (o "Avaliações" do admin é o das estadias) ───────────────────────────
export const TITULO_ADMIN = "Avaliações do imóvel";

/** O botão diz a ação (QA do #1111, item 2), não o estado de destino. A aprovação única do 62-B3 é "Aprovar para teste". */
export function rotuloDecisao(de: StatusCredenciamento, para: StatusCredenciamento): string {
  if (para === "ativo") return de === "em_teste" ? "Aprovar o teste (ativar)" : "Reativar";
  if (para === "em_teste") return "Aprovar para teste";
  if (para === "suspenso") return "Suspender";
  return "Descredenciar";
}

export interface PosicaoRodizio {
  id: string;
  posicao: number | null;
  impedimento: string | null;
}

/**
 * A fila de rodízio de uma cidade como o admin vê: quem está elegível, na ordem em que será designado (há mais tempo
 * sem designação primeiro), e quem está fora com o motivo. Impedimentos que dependem do pedido (serviço ao dono,
 * relação declarada) aparecem na hora da designação; aqui só os da própria pessoa.
 */
export function filaDeRodizio(fila: AvaliadorFila[], cidade: string, agora: Date): PosicaoRodizio[] {
  const daCidade = fila.filter((a) => chaveCidade(a.cidade) === chaveCidade(cidade));
  const neutro = { id: "", propertyId: "", ownerId: "", cidade, tipo: "inicial" as const, teste: false, primeiroAvaliadorId: null, jaDesignados: [] };
  const historico = { servicosAoDono: [], avaliacoesDoImovel: [] };
  const t = (s: string | null) => (s ? Date.parse(s) : -Infinity);
  const ordem = [...daCidade].sort((x, y) => t(x.ultimaDesignacaoEm) - t(y.ultimaDesignacaoEm) || Date.parse(x.credenciadoEm) - Date.parse(y.credenciadoEm) || x.id.localeCompare(y.id));
  let n = 0;
  return ordem.map((a) => {
    const m: MotivoImpedimento | null = impedimento(a, neutro, historico, agora);
    return { id: a.id, posicao: m ? null : ++n, impedimento: m ? ROTULO_IMPEDIMENTO[m] : null };
  });
}

/** Os números do topo do admin ("decisões primeiro"): cada um leva à sua seção. */
export function contagemDecisoes(e: { credenciamentos: { status: StatusCredenciamento }[]; semAvaliador: number; recusasAusencias: number; cidadesProntas: number; cidades: number }) {
  return [
    { chave: "credenciamentos", rotulo: "credenciamentos para decidir", valor: e.credenciamentos.filter((c) => c.status === "solicitado" || c.status === "em_teste").length, ancora: "#credenciamento" },
    { chave: "sem-avaliador", rotulo: "pedidos sem avaliador elegível", valor: e.semAvaliador, ancora: "#sem-avaliador" },
    { chave: "recusas", rotulo: "recusas e ausências (30 dias)", valor: e.recusasAusencias, ancora: "#recusas" },
    { chave: "chave", rotulo: `de ${e.cidades} ${e.cidades === 1 ? "cidade pronta" : "cidades prontas"} para ligar`, valor: e.cidadesProntas, ancora: "#chave" },
  ];
}

/**
 * E35-B: o complemento do passo "Identidade verificada" enquanto não está confirmada. Com o provedor de verificação
 * ainda desligado ("em breve"), avisa que o passo é da ativação e que a verificação abre perto do lançamento.
 */
export const TEXTO_IDENTIDADE_EM_BREVE = "Na ativação · a verificação abre perto do lançamento";
export function complementoPassoIdentidade(estado: "confirmada" | "vencida" | "simulavel" | "em_breve"): string | null {
  if (estado === "confirmada") return null;
  return estado === "em_breve" ? TEXTO_IDENTIDADE_EM_BREVE : "Na ativação";
}
