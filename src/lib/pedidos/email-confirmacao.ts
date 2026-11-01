/*
  E402 — confirmação ao morador quando ele PUBLICA ou EDITA o pedido de moradia. PURO.
  Antes, publicar ou mudar o orçamento (R$ 2.500 → R$ 2.600) não mandava nada ao morador. Agora sai um e-mail no padrão
  dos demais (assunto com a cidade, abertura curta e o bloco de dados do pedido — as mesmas linhas do cartão do pedido dos
  e-mails proativos, linhasDoPedido). Na edição, a linha que mudou mostra o valor anterior.
  Sem dado pessoal: nada de nome de terceiro, contato ou apresentação.
  Roda: node --test src/lib/pedidos/email-confirmacao.test.ts
*/
import { linhasDoPedido, type PedidoDoCartao } from "../notifications/cartoes-email.ts";
import { linhaLocalizacao } from "../localizacao.ts";
import { assuntoPedidoConfirmado } from "../notifications/assuntos.ts";

export type AcaoPedido = "publicado" | "editado";

export interface LinhaDado {
  rotulo: string;
  valor: string;
}

export interface CorpoConfirmacaoPedido {
  subject: string;
  body: (nome?: string) => string;
  linhas: LinhaDado[];
}

const ola = (n?: string) => `Olá${n ? ` ${n}` : ""}`;

/** As linhas que mudaram entre a versão anterior e a nova do pedido (mesmos rótulos do cartão). */
export function mudancasDoPedido(antes: PedidoDoCartao, depois: PedidoDoCartao): { rotulo: string; de: string; para: string }[] {
  const a = new Map(linhasDoPedido(antes).map((l) => [l.rotulo, l.valor]));
  return linhasDoPedido(depois)
    .filter((l) => a.get(l.rotulo) !== l.valor)
    .map((l) => ({ rotulo: l.rotulo, de: a.get(l.rotulo) ?? "", para: l.valor }));
}

/**
 * O e-mail de confirmação. `compativeis`: quantos imóveis combinam agora (a mesma conta que a tela mostra ao publicar);
 * `antes`: a versão anterior, só na edição — a linha que mudou sai como "novo (antes: velho)".
 */
export function corpoConfirmacaoPedido(
  acao: AcaoPedido,
  pedido: PedidoDoCartao,
  opcoes: { compativeis?: number; antes?: PedidoDoCartao | null } = {},
): CorpoConfirmacaoPedido {
  const lugar = linhaLocalizacao(null, (pedido.cidade ?? "").trim(), (pedido.uf ?? "").trim()) || "sua cidade";
  const n = Math.max(0, Math.round(opcoes.compativeis ?? 0));
  const combinam =
    n === 0
      ? "Ainda não há imóvel que combine; avisamos você quando surgir um."
      : n === 1
        ? "1 imóvel combina com ele agora, e o proprietário foi avisado."
        : `${n} imóveis combinam com ele agora, e os proprietários foram avisados.`;

  const mudou = acao === "editado" && opcoes.antes ? mudancasDoPedido(opcoes.antes, pedido) : [];
  const anterior = new Map(mudou.map((m) => [m.rotulo, m.de]));
  const linhas = linhasDoPedido(pedido).map((l) => (anterior.has(l.rotulo) ? { rotulo: l.rotulo, valor: `${l.valor} (antes: ${anterior.get(l.rotulo)})` } : l));

  if (acao === "publicado") {
    return {
      subject: assuntoPedidoConfirmado("publicado", pedido.cidade),
      body: (nome) => `${ola(nome)}, seu pedido de moradia em ${lugar} está publicado. ${combinam} Quando um proprietário responder, você recebe aqui.`,
      linhas,
    };
  }
  const oQue = mudou.length ? ` Mudou: ${mudou.map((m) => m.rotulo.toLowerCase()).join(", ")}.` : "";
  return {
    subject: assuntoPedidoConfirmado("editado", pedido.cidade),
    body: (nome) => `${ola(nome)}, salvamos as mudanças no seu pedido de moradia em ${lugar}.${oQue} ${combinam}`,
    linhas,
  };
}

/** A linha do pedido no formato do cartão, a partir da linha do banco (pedidos_moradia). */
export function pedidoDaLinha(p: {
  id: string;
  cidade?: string | null;
  uf?: string | null;
  data_inicio?: string | null;
  prazo_meses?: number | null;
  orcamento_mensal?: number | string | null;
  qtd_ocupantes?: number | null;
  pets?: boolean | null;
}): PedidoDoCartao {
  return {
    id: p.id,
    cidade: String(p.cidade ?? ""),
    uf: p.uf ?? null,
    entrada: String(p.data_inicio ?? ""),
    meses: Number(p.prazo_meses) || 0,
    orcamento: Number(p.orcamento_mensal) || 0,
    pessoas: Number(p.qtd_ocupantes) || 1,
    pets: p.pets ?? null,
  };
}

/** Colunas que o e-mail lê do pedido. */
export const COLUNAS_PEDIDO_EMAIL = "id, cidade, uf, data_inicio, prazo_meses, orcamento_mensal, qtd_ocupantes, pets";
