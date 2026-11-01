/*
  E375-B — corpo do e-mail do RESUMO SEMANAL. PURO; quem envia é resumo-semanal-servidor.ts pelo notify() (o mesmo
  modelo único: cabeçalho, rodapé e redes oficiais vêm do modelo-email.ts).
    • Até 2 seções (novos para o pedido ou para a busca; "Baixou o valor"), 3 cartões cada e "ver os N".
    • Cartão: foto real, total por mês com o rótulo da casa, m², quartos, vagas, bairro e cidade (nunca a rua), o botão
      "Ver o imóvel" e o motivo (só fatos reais do casamento).
    • Link de descadastro VISÍVEL no corpo e a assinatura "Um abraço, equipe Viva Nomads".
  Roda: node --test src/lib/notifications/resumo-semanal.test.ts
*/
import { cartaoImovel, type ImovelDoCartao } from "./cartoes-email.ts";
import { TEXTO_DESCADASTRO } from "./proativos.ts";
import { assuntoResumo, CARTOES_POR_SECAO, cidadeComum, paraQuem, type OrigemDoResumo } from "./resumo-semanal.ts";
import { escaparHtml } from "../escapar-html.ts";

export const ASSINATURA_RESUMO = "Um abraço, equipe Viva Nomads";

export interface SecaoResumo {
  tipo: "novos" | "baixas";
  itens: ImovelDoCartao[];
}

export interface EmailResumoSemanal {
  /** Sem a marca (o notify põe "· Viva Nomads"). */
  assunto: string;
  abertura: (nome?: string) => string;
  detailsHtml: string;
  detailsText: string;
  pushUrl: string;
  /** Cartões no corpo (o resto está no "ver os N"). */
  cartoes: number;
}

const CAMINHO = { pedido: "/dashboard/pedidos", busca: "/dashboard/buscas", ambos: "/dashboard/pedidos", baixas: "/dashboard/favoritos" } as const;

function tituloDaSecao(tipo: SecaoResumo["tipo"], origem: OrigemDoResumo, n: number): string {
  if (tipo === "baixas") return n === 1 ? "Baixou o valor" : "Baixaram o valor";
  return `Novos para ${paraQuem(origem)}`;
}

export function montarEmailResumoSemanal(o: {
  siteUrl: string;
  nome?: string | null;
  origem: OrigemDoResumo;
  novos: readonly ImovelDoCartao[];
  baixas: readonly ImovelDoCartao[];
  descadastroUrl: string | null;
}): EmailResumoSemanal {
  const secoes: SecaoResumo[] = [
    ...(o.novos.length ? [{ tipo: "novos" as const, itens: [...o.novos] }] : []),
    ...(o.baixas.length ? [{ tipo: "baixas" as const, itens: [...o.baixas] }] : []),
  ];
  let cartoes = 0;
  const html: string[] = [];
  const text: string[] = [];
  for (const s of secoes) {
    const titulo = tituloDaSecao(s.tipo, o.origem, s.itens.length);
    const mostrados = s.itens.slice(0, CARTOES_POR_SECAO);
    const feitos = mostrados.map((i) => cartaoImovel(o.siteUrl, i));
    cartoes += feitos.length;
    const caminho = s.tipo === "baixas" ? CAMINHO.baixas : CAMINHO[o.origem];
    const verTodos =
      s.itens.length > CARTOES_POR_SECAO
        ? { rotulo: `Ver os ${s.itens.length} imóveis`, url: `${o.siteUrl}${caminho}` }
        : null;
    html.push(
      `<h2 class="vn-t" data-secao="${s.tipo}" style="margin:20px 0 10px;font-size:17px;font-weight:800;color:#0f3d2e;">${escaparHtml(titulo)}</h2>` +
        feitos.map((c) => c.html).join("") +
        (verTodos ? `<p style="margin:4px 0 16px;"><a href="${verTodos.url}" style="color:#1c6b3a;font-weight:700;">${escaparHtml(verTodos.rotulo)} →</a></p>` : ""),
    );
    text.push([titulo.toLocaleUpperCase("pt-BR"), ...feitos.map((c) => c.text), verTodos ? `${verTodos.rotulo}: ${verTodos.url}` : ""].filter(Boolean).join("\n\n"));
  }
  const sair = o.descadastroUrl
    ? `<p class="vn-mut" style="margin:16px 0 0;font-size:12px;color:#6b7280;">Você recebe este resumo uma vez por semana, às terças. <a href="${o.descadastroUrl}" style="color:#6b7280;">${TEXTO_DESCADASTRO}</a>.</p>`
    : "";
  const assinatura = `<p class="vn-p" style="margin:16px 0 0;font-size:14px;color:#123b26;">${ASSINATURA_RESUMO}</p>`;
  const nNovos = o.novos.length;
  const nBaixas = o.baixas.length;
  const cidade = cidadeComum(o.novos.map((i) => i.cidade));
  return {
    assunto: assuntoResumo({ nome: o.nome, novos: nNovos, origem: o.origem, cidade, baixas: nBaixas }),
    abertura: (nome) => {
      const ola = `Olá${nome ? " " + nome : ""}`;
      const partes = [
        nNovos ? `${nNovos === 1 ? "1 imóvel novo" : `${nNovos} imóveis novos`} para ${o.origem === "pedido" ? "o seu pedido de moradia" : o.origem === "busca" ? "a sua busca salva" : "o seu pedido e a sua busca"}` : "",
        nBaixas ? `${nBaixas === 1 ? "1 imóvel que você favoritou baixou" : `${nBaixas} imóveis que você favoritou baixaram`} de valor` : "",
      ].filter(Boolean);
      return `${ola}, este é o seu resumo da semana: ${partes.join(" e ")}.`;
    },
    detailsHtml: `<div style="margin-top:8px;">${html.join("")}</div>${sair}${assinatura}`,
    detailsText: [...text, o.descadastroUrl ? `${TEXTO_DESCADASTRO}: ${o.descadastroUrl}` : "", ASSINATURA_RESUMO].filter(Boolean).join("\n\n"),
    pushUrl: nNovos ? CAMINHO[o.origem] : CAMINHO.baixas,
    cartoes,
  };
}
