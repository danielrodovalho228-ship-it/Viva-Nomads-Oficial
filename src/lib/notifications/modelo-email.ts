/*
  MODELO ÚNICO de e-mail do Viva Nomads (ordem d250ea2f, item 1) — PURO (sem
  imports "@/…"), para os e-mails do app (templates.ts) e os de conta do
  Supabase (supabase/templates/) saírem do MESMO layout.
  HTML e-mail-safe: tabelas + estilo inline; modo escuro por @media
  (prefers-color-scheme) e color-scheme.
*/
import { AVISO_ANTIGOLPE, rodapeAntigolpeHtml } from "./aviso-antigolpe.ts";
import { REDES_OFICIAIS } from "../../config/redes.ts";

export type ImagemEmail = { src: string; alt: string };

/**
 * Blocos do rodapé que ficam PRONTOS mas DESLIGADOS: só ligam depois do CNPJ e
 * do app nas lojas (preencher os dados e trocar `ativo` para true).
 * Redes: LIGADO com a constante única REDES_OFICIAIS (Prompt 35A, item 4).
 */
export interface RodapeOpcional {
  lojas: { ativo: boolean; ios: string; android: string };
  redes: { ativo: boolean; links: { nome: string; url: string }[] };
  endereco: { ativo: boolean; texto: string };
}

export const RODAPE_OPCIONAL: RodapeOpcional = {
  lojas: { ativo: false, ios: "", android: "" },
  redes: { ativo: REDES_OFICIAIS.length > 0, links: [...REDES_OFICIAIS] },
  endereco: { ativo: false, texto: "" },
};

export function rodapeOpcionalHtml(cfg: RodapeOpcional = RODAPE_OPCIONAL): string {
  const partes: string[] = [];
  if (cfg.lojas.ativo && (cfg.lojas.ios || cfg.lojas.android)) {
    const l = [
      cfg.lojas.ios ? `<a href="${cfg.lojas.ios}" style="color:#0A4FD6;">App Store</a>` : "",
      cfg.lojas.android ? `<a href="${cfg.lojas.android}" style="color:#0A4FD6;">Google Play</a>` : "",
    ].filter(Boolean);
    partes.push(`Baixe o app: ${l.join(" · ")}`);
  }
  if (cfg.redes.ativo && cfg.redes.links.length) {
    partes.push(cfg.redes.links.map((r) => `<a href="${r.url}" rel="noopener" style="color:#0A4FD6;">${r.nome}</a>`).join(" · "));
  }
  if (cfg.endereco.ativo && cfg.endereco.texto) partes.push(cfg.endereco.texto);
  if (!partes.length) return "";
  return `<p class="vn-mut" style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#6b7280;">${partes.join("<br>")}</p>`;
}

const ESTILO = `<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .vn-bg { background:#0f1512 !important; }
    .vn-card { background:#18211c !important; border-color:#2a3830 !important; }
    .vn-rod { background:#131a16 !important; border-color:#2a3830 !important; }
    .vn-t { color:#eaf3ee !important; }
    .vn-p { color:#cbd5d0 !important; }
    .vn-mut { color:#9fb0a7 !important; }
    .vn-box { background:#1f2b25 !important; border-color:#3a4d42 !important; }
  }
</style>`;

export function botaoEmail(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#1c6b3a;">
    <a href="${url}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
  </td></tr></table>`;
}

/** Bloco "dados úteis" (imóvel, período, prazo…). Valores já vêm escapados por quem chama. */
export function blocoDados(linhas: { rotulo: string; valor: string }[]): string {
  if (!linhas.length) return "";
  const rows = linhas
    .map(
      (l) =>
        `<tr><td class="vn-mut" style="padding:4px 12px 4px 0;font-size:13px;color:#6b7280;white-space:nowrap;">${l.rotulo}</td><td class="vn-t" style="padding:4px 0;font-size:14px;font-weight:600;color:#123b26;">${l.valor}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" class="vn-box" style="width:100%;margin:0 0 20px;padding:10px 14px;background:#f2fbe9;border:1px solid #dcefc5;border-radius:12px;">${rows}</table>`;
}

export function layoutEmail(
  inner: string,
  o: { siteUrl: string; image?: ImagemEmail; preheader?: string; rodape?: RodapeOpcional; semLinkEntrar?: boolean },
): string {
  const site = o.siteUrl;
  const hero = o.image
    ? `<tr><td style="padding:0;font-size:0;line-height:0;"><img src="${o.image.src}" alt="${o.image.alt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" /></td></tr>`
    : "";
  const pre = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;">${o.preheader}</div>`
    : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">${ESTILO}</head><body class="vn-bg" style="margin:0;padding:0;background:#f1f5f4;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${pre}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="vn-bg" style="background:#f1f5f4;padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="vn-card" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:18px 32px;border-bottom:1px solid #eef2f1;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;"><img src="${site}/email-mark.png" width="34" height="34" alt="Viva Nomads" style="display:block;border:0;"></td>
            <td style="vertical-align:middle;padding-left:10px;font-size:20px;font-weight:800;letter-spacing:-0.5px;"><span style="color:#0A4FD6;">Viva</span><span style="color:#5DBB1E;">Nomads</span></td>
          </tr></table></td>
          ${o.semLinkEntrar ? "" : `<td align="right" style="vertical-align:middle;font-size:14px;"><a href="${site}/auth" style="color:#1c6b3a;font-weight:700;text-decoration:none;">Entrar</a></td>`}
        </tr></table>
      </td></tr>
      ${hero}
      <tr><td style="padding:32px;">${inner}</td></tr>
      <tr><td class="vn-rod" style="padding:20px 32px;background:#f8fafc;border-top:1px solid #eef2f1;">
        <p class="vn-mut" style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">Precisa de ajuda? <a href="${site}/ajuda" style="color:#0A4FD6;">Central de Ajuda</a> · <a href="${site}" style="color:#0A4FD6;">vivanomads.com.br</a> · <a href="${site}/dashboard/notificacoes" style="color:#0A4FD6;">Gerenciar avisos</a></p>
        <p class="vn-mut" style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#9ca3af;">Viva Nomads — imóveis mobiliados para estadias de 30 a 180 dias.<br>Se você não solicitou este e-mail, pode ignorá-lo com segurança.</p>
        ${rodapeAntigolpeHtml(site)}
        ${rodapeOpcionalHtml(o.rodape)}
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}

/** Rodapé do texto puro (mesmos links do HTML). */
export function rodapeTexto(siteUrl: string): string {
  return [
    "— Viva Nomads · imóveis mobiliados para estadias de 30 a 180 dias",
    `Precisa de ajuda? Central de Ajuda: ${siteUrl}/ajuda`,
    `Gerenciar avisos: ${siteUrl}/dashboard/notificacoes`,
    // E206: a linha antifraude do HTML também no texto puro.
    `${AVISO_ANTIGOLPE} Dicas de segurança: ${siteUrl}/seguranca`,
    "Plataforma em fase de testes. Lançamento oficial em 2027.",
  ].join("\n");
}
