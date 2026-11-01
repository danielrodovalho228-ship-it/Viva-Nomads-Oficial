/*
  E264-B — CARTÕES dos e-mails proativos: o cartão do imóvel e o cartão do pedido de moradia. PURO.
  Componente único do modelo de e-mail (tabela + estilo inline, modo escuro pelas classes do modelo-email.ts).
    • Imóvel: foto de capa REAL do anúncio público (em JPEG 640 px pela rota /api/email/foto), título, bairro e
      cidade, o total do mês pela função de preço única com o rótulo da casa, e o botão "Ver o imóvel".
      Nunca o endereço exato nem dado do proprietário: só o que a página pública mostra.
    • Pedido: cidade, entrada e duração, orçamento, pessoas e pets. Nunca nome, contato ou outro dado pessoal.
  Roda: node --test src/lib/notifications/proativos.test.ts
*/
import { ROTULO_TOTAL_MES } from "../precos.ts";
import { rotuloPreco } from "../cartao-preco.ts";
import { linhaLocalizacao } from "../localizacao.ts";
import { escaparHtml } from "../escapar-html.ts";

export interface ImovelDoCartao {
  id: string;
  titulo: string;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  /** Total do mês com contas (totalMesDaLinha). */
  totalMes: number;
  /** URL pública da foto de capa (Storage do anúncio). */
  fotoCapa?: string | null;
  /** E375-B (resumo semanal): área, quartos e vagas da página pública; ausentes, a linha não aparece. */
  areaM2?: number | null;
  quartos?: number | null;
  vagas?: number | null;
  /** E375-B: por que este imóvel está no e-mail (só fatos reais do casamento). */
  motivo?: string | null;
}

/** "62 m² · 2 quartos · 1 vaga" (só o que o anúncio informa). */
export function linhaFichaDoImovel(i: Pick<ImovelDoCartao, "areaM2" | "quartos" | "vagas">): string {
  const n = (v: number | null | undefined) => (v != null && Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);
  const area = n(i.areaM2);
  const quartos = n(i.quartos);
  const vagas = i.vagas == null ? null : Math.max(0, Math.round(Number(i.vagas)) || 0);
  return [
    area ? `${area} m²` : "",
    quartos ? `${quartos} ${quartos === 1 ? "quarto" : "quartos"}` : "",
    vagas == null ? "" : vagas === 0 ? "sem vaga" : `${vagas} ${vagas === 1 ? "vaga" : "vagas"}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export interface PedidoDoCartao {
  id: string;
  cidade: string;
  uf?: string | null;
  /** yyyy-mm-dd */
  entrada: string;
  meses: number;
  orcamento: number;
  pessoas: number;
  pets: boolean | null;
}

const brl = (v: number) => `R$ ${Math.round(Number(v) || 0).toLocaleString("pt-BR")}`;
const dataBR = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};
const limpo = (s: string | null | undefined, max = 120) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Largura e qualidade da foto do cartão (640 px, q 75). E274: eram os valores que o otimizador do Next 16 aceita; o
 * e-mail agora usa a rota própria (/api/email/foto), que segue o mesmo tamanho.
 */
export const FOTO_CARTAO = { largura: 640, qualidade: 75 } as const;

/** Caminho da capa dentro do bucket público property-photos (`<uuid>/<uuid>.<ext>`), ou null se não for uma capa nossa. */
const CAPA_RE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/property-photos\/([0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:webp|jpe?g|png))$/i;
export const CAMINHO_FOTO_EMAIL_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:webp|jpe?g|png)$/i;

export function caminhoDaCapa(foto: string | null | undefined): string | null {
  return CAPA_RE.exec(String(foto ?? ""))?.[1] ?? null;
}

/**
 * Foto de capa do cartão do e-mail. E264-B (01/11): a foto não aparecia no corpo do e-mail. As capas são WebP, e o
 * otimizador do site (/_next/image) responde por negociação (`Vary: Accept`: AVIF/WebP a quem aceita), como ANEXO
 * (`Content-Disposition: attachment`) e com CSP `sandbox` — leitores de e-mail que não mostram AVIF/WebP, ou o proxy
 * de imagens que guarda uma variante só, ficavam sem a foto. A rota própria /api/email/foto devolve SEMPRE JPEG, inline,
 * 640 px, sem variar por cliente. Só capas do bucket property-photos (nunca uma URL qualquer).
 */
export function fotoDoCartao(siteUrl: string, foto: string | null | undefined): string | null {
  const caminho = caminhoDaCapa(foto);
  return caminho ? `${siteUrl}/api/email/foto?p=${caminho}` : null;
}

export function urlDoImovel(siteUrl: string, id: string): string {
  return `${siteUrl}/imoveis/${encodeURIComponent(id)}`;
}

function botaoCartao(url: string, rotulo: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:12px;background:#1c6b3a;color:#ffffff;padding:10px 18px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;">${escaparHtml(rotulo)}</a>`;
}

/** Cartão do imóvel (HTML e a linha do texto puro). */
export function cartaoImovel(siteUrl: string, i: ImovelDoCartao): { html: string; text: string } {
  const titulo = limpo(i.titulo) || "Imóvel mobiliado";
  const lugar = linhaLocalizacao(limpo(i.bairro, 60), limpo(i.cidade, 60), limpo(i.uf, 2));
  const url = urlDoImovel(siteUrl, i.id);
  const foto = fotoDoCartao(siteUrl, i.fotoCapa);
  // A função de preço única (a mesma do cartão da busca e da página do imóvel), sobre o total do mês com contas.
  const total = i.totalMes > 0 ? rotuloPreco({ mensal: i.totalMes }).valor.replace(/\u00a0/g, " ") : null;
  const ficha = linhaFichaDoImovel(i);
  const motivo = limpo(i.motivo, 220);
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="vn-box" data-cartao="imovel" style="margin:0 0 16px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
  ${foto ? `<tr><td style="padding:0;font-size:0;line-height:0;"><a href="${url}"><img src="${foto}" alt="${escaparHtml(titulo)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;" /></a></td></tr>` : ""}
  <tr><td style="padding:14px 16px;">
    <div class="vn-t" style="font-size:16px;font-weight:700;color:#0f3d2e;">${escaparHtml(titulo)}</div>
    ${lugar ? `<div class="vn-p" style="margin-top:2px;font-size:14px;color:#475569;">${escaparHtml(lugar)}</div>` : ""}
    ${ficha ? `<div class="vn-p" data-ficha style="margin-top:2px;font-size:13px;color:#475569;">${escaparHtml(ficha)}</div>` : ""}
    ${total ? `<div style="margin-top:8px;font-size:13px;color:#6b7280;" class="vn-mut">${escaparHtml(ROTULO_TOTAL_MES)}</div><div class="vn-t" style="font-size:18px;font-weight:800;color:#123b26;">${total}</div>` : ""}
    ${motivo ? `<div class="vn-p" data-motivo style="margin-top:8px;font-size:13px;color:#1c6b3a;">${escaparHtml(motivo)}</div>` : ""}
    ${botaoCartao(url, "Ver o imóvel")}
  </td></tr>
</table>`;
  const text = [
    `• ${titulo}${lugar ? ` — ${lugar}` : ""}`,
    ficha ? `  ${ficha}` : "",
    total ? `  ${ROTULO_TOTAL_MES}: ${total}` : "",
    motivo ? `  ${motivo}` : "",
    `  Ver o imóvel: ${url}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { html, text };
}

/** As linhas do cartão do pedido (sem dado pessoal). */
export function linhasDoPedido(p: PedidoDoCartao): { rotulo: string; valor: string }[] {
  const lugar = linhaLocalizacao(null, limpo(p.cidade, 60), limpo(p.uf, 2));
  const pessoas = Math.max(1, Math.round(p.pessoas || 1));
  return [
    { rotulo: "Cidade", valor: lugar },
    { rotulo: "Entrada", valor: `${dataBR(p.entrada)} · ${p.meses} ${p.meses === 1 ? "mês" : "meses"}` },
    { rotulo: "Orçamento", valor: `até ${brl(p.orcamento)} por mês` },
    { rotulo: "Pessoas", valor: String(pessoas) },
    { rotulo: "Pets", valor: p.pets == null ? "Não informado" : p.pets ? "Sim" : "Não" },
  ];
}

/** Cartão do pedido (HTML e o texto puro). `botao`: rótulo e destino do cartão. */
export function cartaoPedido(p: PedidoDoCartao, botao: { rotulo: string; url: string }, contexto?: string | null): { html: string; text: string } {
  const linhas = linhasDoPedido(p);
  const rows = linhas
    .map(
      (l) =>
        `<tr><td class="vn-mut" style="padding:3px 12px 3px 0;font-size:13px;color:#6b7280;white-space:nowrap;">${l.rotulo}</td><td class="vn-t" style="padding:3px 0;font-size:14px;font-weight:600;color:#123b26;">${escaparHtml(l.valor)}</td></tr>`,
    )
    .join("");
  const ctx = contexto ? limpo(contexto, 160) : "";
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="vn-box" data-cartao="pedido" style="margin:0 0 16px;border:1px solid #dcefc5;background:#f2fbe9;border-radius:12px;">
  <tr><td style="padding:14px 16px;">
    <div class="vn-t" style="font-size:15px;font-weight:700;color:#0f3d2e;">Pedido de moradia</div>
    ${ctx ? `<div class="vn-p" style="margin-top:2px;font-size:13px;color:#475569;">${escaparHtml(ctx)}</div>` : ""}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;">${rows}</table>
    ${botaoCartao(botao.url, botao.rotulo)}
  </td></tr>
</table>`;
  const text = [`• Pedido de moradia${ctx ? ` (${ctx})` : ""}`, ...linhas.map((l) => `  ${l.rotulo}: ${l.valor}`), `  ${botao.rotulo}: ${botao.url}`].join("\n");
  return { html, text };
}
