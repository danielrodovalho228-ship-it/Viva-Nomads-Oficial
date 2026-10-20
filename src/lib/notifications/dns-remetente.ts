/*
  Conferência do DNS do domínio que envia os e-mails (rota rápida "e-mails profissionais", item 5) — PURO.
  SPF e DKIM do Resend e DMARC do domínio. O script scripts/conferir-dns-email.ts lê os registros (no CI, que tem
  DNS) e publica a tabela; faltando DMARC, diz o registro exato para o Daniel criar.
*/
import { SITE_DOMAIN, SUPORTE_EMAIL } from "../site.ts";

export const DOMINIO_ENVIO = SITE_DOMAIN;
/** Nomes consultados: raiz e "send." (SPF do Resend), "resend._domainkey." (DKIM), "_dmarc." (DMARC). */
export const NOMES_DNS = {
  raiz: DOMINIO_ENVIO,
  envio: `send.${DOMINIO_ENVIO}`,
  dkim: `resend._domainkey.${DOMINIO_ENVIO}`,
  dmarc: `_dmarc.${DOMINIO_ENVIO}`,
} as const;

/** Registro DMARC sugerido (começa observando, sem rejeitar nada). */
export const DMARC_SUGERIDO = `v=DMARC1; p=none; rua=mailto:${SUPORTE_EMAIL}; fo=1`;

export interface RegistrosDns {
  raiz: string[];
  envio: string[];
  dkim: string[];
  dmarc: string[];
}

export interface ItemDns {
  item: "SPF" | "DKIM" | "DMARC";
  ok: boolean;
  detalhe: string;
}

export function avaliarDns(r: RegistrosDns): ItemDns[] {
  const spf = [...r.envio, ...r.raiz].find((t) => /^v=spf1\b/i.test(t.trim()));
  const dkim = r.dkim.find((t) => /\bp=[A-Za-z0-9+/=]{20,}/.test(t.replace(/\s+/g, "")));
  const dmarc = r.dmarc.find((t) => /^v=DMARC1\b/i.test(t.trim()));
  return [
    { item: "SPF", ok: !!spf, detalhe: spf ? spf.trim() : `sem registro v=spf1 em ${NOMES_DNS.envio} nem em ${NOMES_DNS.raiz}` },
    { item: "DKIM", ok: !!dkim, detalhe: dkim ? `chave publicada em ${NOMES_DNS.dkim}` : `sem chave DKIM do Resend em ${NOMES_DNS.dkim}` },
    {
      item: "DMARC",
      ok: !!dmarc,
      detalhe: dmarc ? dmarc.trim() : `falta: criar TXT em ${NOMES_DNS.dmarc} com o valor "${DMARC_SUGERIDO}"`,
    },
  ];
}

export function tabelaDns(itens: ItemDns[]): string {
  return ["| Registro | Situação | Detalhe |", "| --- | --- | --- |", ...itens.map((i) => `| ${i.item} | ${i.ok ? "ok" : "falta"} | ${i.detalhe.replace(/\|/g, "\\|")} |`)].join("\n");
}
