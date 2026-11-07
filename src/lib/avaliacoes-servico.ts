/*
  E679 — PR 5: "Avalie o serviço" (cliente) e "Avalie o cliente" (parceiro), iguais aos mockups avaliacoes-avaliar-servico-*.
  Os textos de cada par e a linha do pedido. Critérios e etiquetas moram em avaliacoes-criterios.ts (Pista B).
*/
import { formatBRL } from "./utils.ts";

interface TextosServico {
  pagina: string;
  geral: string;
  etiquetas: string;
  texto: string;
  placeholder: string;
  recomenda: string;
  /** Faixa âmbar do parceiro: a nota dele ao cliente é só entre parceiros. */
  avisoEntreParceiros: string | null;
}

export const TEXTOS_SERVICO: Record<"cliente_avalia_parceiro" | "parceiro_avalia_cliente", TextosServico> = {
  cliente_avalia_parceiro: {
    pagina: "Avalie o serviço",
    geral: "Como foi, no geral?",
    etiquetas: "Destaques do serviço",
    texto: "Conte como foi o serviço",
    placeholder: "Conte mais detalhes: o que foi feito bem? O que pode melhorar?",
    recomenda: "Você contrataria de novo?",
    avisoEntreParceiros: null,
  },
  parceiro_avalia_cliente: {
    pagina: "Avalie o cliente",
    geral: "Como foi, no geral?",
    etiquetas: "Selecione tags que descrevem o cliente",
    texto: "Algum comentário sobre o atendimento?",
    placeholder: "Conte como foi a experiência, o que deu certo, pontos de melhoria...",
    recomenda: "Você receberia este cliente de novo?",
    avisoEntreParceiros: "Nota entre parceiros: esta avaliação aparece só para outros parceiros. Ela não fica no perfil público do cliente.",
  },
};

/** "Serviço concluído · Pedido VN-SV-ABC12345 · R$ 280" — só o que existe. */
export function linhaDoPedido(p: { codigo: string; valor: number | null }): string {
  const valor = p.valor != null && p.valor > 0 ? ` · ${formatBRL(p.valor).replace(/\u00a0/g, " ")}` : "";
  return `Serviço concluído · Pedido ${p.codigo}${valor}`;
}
