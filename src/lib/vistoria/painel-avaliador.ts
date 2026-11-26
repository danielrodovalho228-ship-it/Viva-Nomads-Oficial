/*
  E1079 (ORDEM-DUET-385/386), fatia 2 — o painel do avaliador, como no mockup aprovado (avaliador-painel): a saudação,
  as visitas de hoje e os quatro cartões. Regra PURA (testada em e1079-painel-avaliador.test.ts); quem desenha é
  components/avaliadores/painel.tsx. Nome, contagens e valores vêm do sistema — o desenho só traz exemplos.

  ORDEM-DUET-397: o valor da avaliação é o da TABELA DA CIDADE para o porte do imóvel (não é o avaliador que o define).
*/
import { diaBRT } from "../datas-brasilia.ts";
import { primeiroNome } from "../display-name.ts";
import { brl } from "../fiscal/documento.ts";
import { visitaConfirmada } from "./visitas-confirmadas.ts";

/** O que o painel precisa de cada pedido do avaliador. */
export interface PedidoDoPainel {
  status: string;
  agendado_para: string | null;
  recebido_marcado_em: string | null;
  valor_tabela: number | string;
  valor_proposto: number | string | null;
  proposta_aceita_em: string | null;
  teste: boolean;
}

export interface ResumoDoPainel {
  /** Visitas agendadas para hoje (dia de Brasília) e ainda por fazer. */
  visitasHoje: number;
  /** Pedidos à espera da resposta do avaliador. */
  novos: number;
  /** Soma do que o avaliador marcou como recebido. */
  recebido: number;
}

/** "Olá, <primeiro nome>!" — o primeiro nome da conta; sem nome, saúda sem identificador (nunca o e-mail). */
export function saudacaoDoAvaliador(nomeCompleto: string | null | undefined): string {
  const n = primeiroNome(nomeCompleto);
  return n ? `Olá, ${n}!` : "Olá!";
}

const visitas = (n: number) => `${n} ${n === 1 ? "visita" : "visitas"}`;

/** A frase por baixo da saudação. */
export function fraseVisitasHoje(n: number): string {
  return n > 0 ? `Você tem ${visitas(n)} hoje` : "Você não tem visita hoje";
}

/** A frase da faixa verde, por cima do botão "Ver pedidos". */
export function faixaVisitasHoje(n: number): string {
  return n > 0 ? `${visitas(n)} para hoje` : "Nenhuma visita para hoje";
}

/**
 * O valor de um pedido: o da tabela da cidade para o porte (ORDEM-397). Um pedido antigo em que o proprietário aceitou
 * outro valor vale pelo que foi combinado nele.
 */
export function valorDoPedido(p: PedidoDoPainel): number {
  const combinado = p.proposta_aceita_em && p.valor_proposto != null ? Number(p.valor_proposto) : Number(p.valor_tabela);
  return Number.isFinite(combinado) ? combinado : 0;
}

/** O resumo do dia: `novos` é a contagem dos pedidos à espera de resposta (a página já a tem). */
export function resumoDoPainel(pedidos: readonly PedidoDoPainel[], novos: number, agora: Date): ResumoDoPainel {
  const hoje = diaBRT(agora);
  // E1103: a mesma regra da Agenda do parceiro (visita confirmada).
  const visitasHoje = pedidos.filter((p) => visitaConfirmada(p) && diaBRT(p.agendado_para) === hoje).length;
  // A avaliação de teste não tem valor.
  const recebido = pedidos.filter((p) => p.recebido_marcado_em && !p.teste).reduce((s, p) => s + valorDoPedido(p), 0);
  return { visitasHoje, novos, recebido };
}

export interface CartaoDoPainel {
  id: "pedidos" | "agenda" | "recebidos" | "credenciamento";
  titulo: string;
  texto: string;
  /** O texto em verde (no desenho, "1 novo"). */
  destaque: boolean;
  /** A seção da página para onde o cartão leva. */
  href: string;
}

/** Os quatro cartões, na ordem do desenho. O quarto diz o estado do credenciamento (o que o sistema tem). */
export function CARTOES_DO_PAINEL(r: ResumoDoPainel, estadoCredenciamento: string): CartaoDoPainel[] {
  return [
    { id: "pedidos", titulo: "Pedidos", texto: r.novos > 0 ? `${r.novos} ${r.novos === 1 ? "novo" : "novos"}` : "Nenhum novo", destaque: r.novos > 0, href: "#pedidos" },
    { id: "agenda", titulo: "Agenda", texto: r.visitasHoje > 0 ? `Hoje • ${visitas(r.visitasHoje)}` : "Hoje • sem visita", destaque: false, href: "#agenda" },
    { id: "recebidos", titulo: "Recebidos", texto: brl(r.recebido), destaque: false, href: "#historico" },
    { id: "credenciamento", titulo: "Credenciamento", texto: estadoCredenciamento, destaque: false, href: "#credenciamento" },
  ];
}
