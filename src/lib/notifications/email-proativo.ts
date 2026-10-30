/*
  E264-B — corpo dos e-mails proativos: até 3 cartões, "ver os N" quando há mais, e a linha "Não quero mais este tipo
  de e-mail" (descadastro de um clique da categoria "Sugestões e novidades"). PURO; quem envia é proativos-servidor.ts
  pelo notify() (o mesmo modelo único de e-mail).
  Roda: node --test src/lib/notifications/proativos.test.ts
*/
import { cartaoImovel, cartaoPedido, type ImovelDoCartao, type PedidoDoCartao } from "./cartoes-email.ts";
import { aberturaProativo, assuntoProativo, botaoFinal, BOTAO_CARTAO, CAMINHO_PROATIVO, MAX_CARTOES, TEXTO_DESCADASTRO, type EventoProativo } from "./proativos.ts";
import { escaparHtml } from "../escapar-html.ts";

export type ItemProativo =
  | { tipo: "imovel"; imovel: ImovelDoCartao }
  | { tipo: "pedido"; pedido: PedidoDoCartao; urlBotao: string; contexto?: string | null };

export interface EmailProativo {
  evento: EventoProativo;
  /** Sem a marca (o notify põe "· Viva Nomads"). */
  assunto: string;
  abertura: (nome?: string) => string;
  detailsHtml: string;
  detailsText: string;
  pushUrl: string;
  /** Quantos cartões foram no corpo (o resto está no "ver os N"). */
  cartoes: number;
}

export function montarEmailProativo(o: {
  siteUrl: string;
  evento: EventoProativo;
  itens: readonly ItemProativo[];
  /** Total de itens do lote (pode ser maior que os itens com dados completos). */
  total?: number;
  descadastroUrl: string | null;
  diasParaExpirar?: number | null;
}): EmailProativo {
  const n = Math.max(o.total ?? o.itens.length, o.itens.length);
  const mostrados = o.itens.slice(0, MAX_CARTOES);
  const cartoes = mostrados.map((i) => {
    if (i.tipo === "imovel") return cartaoImovel(o.siteUrl, i.imovel);
    const rotulo = o.evento === "pedido_expirando" ? BOTAO_CARTAO.pedidoMorador : BOTAO_CARTAO.pedidoDono;
    return cartaoPedido(i.pedido, { rotulo, url: i.urlBotao }, i.contexto);
  });
  const final = botaoFinal(o.evento, n);
  const finalHtml = final
    ? `<p style="margin:4px 0 16px;"><a href="${o.siteUrl}${final.caminho}" style="color:#1c6b3a;font-weight:700;">${escaparHtml(final.rotulo)} →</a></p>`
    : "";
  const sair = o.descadastroUrl
    ? `<p class="vn-mut" style="margin:16px 0 0;font-size:12px;color:#6b7280;">Você recebe no máximo 1 e-mail de sugestões por dia. <a href="${o.descadastroUrl}" style="color:#6b7280;">${TEXTO_DESCADASTRO}</a>.</p>`
    : "";
  const detailsHtml = `<div style="margin-top:16px;">${cartoes.map((c) => c.html).join("")}</div>${finalHtml}${sair}`;
  const detailsText = [
    ...cartoes.map((c) => c.text),
    final ? `${final.rotulo}: ${o.siteUrl}${final.caminho}` : "",
    o.descadastroUrl ? `${TEXTO_DESCADASTRO}: ${o.descadastroUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    evento: o.evento,
    assunto: assuntoProativo(o.evento, n, o.diasParaExpirar),
    abertura: (nome) => aberturaProativo(o.evento, n, nome),
    detailsHtml,
    detailsText,
    pushUrl: CAMINHO_PROATIVO[o.evento],
    cartoes: cartoes.length,
  };
}
