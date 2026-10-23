/*
  Prompt 62-A, Parte 1 — textos e regras de EXIBIÇÃO das telas da avaliação do imóvel do dono e do morador. PURO
  (node --test). As regras de negócio ficam em ./regras.ts (Pista B); aqui só o que a tela mostra. O credenciamento, a
  página pública do avaliador, a agenda do avaliador e o admin voltam depois do 62-B3 (caminho novo do credenciamento).
  Na tela: "avaliação do imóvel" e "avaliador credenciado". Nenhum número de ganho por nível; o dono não escolhe.
*/
import { ETIQUETA_BRASILIA, dataBRT, horaBRT } from "../datas-brasilia.ts";

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
