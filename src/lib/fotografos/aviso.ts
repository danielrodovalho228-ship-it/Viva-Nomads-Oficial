import { chaveCidade } from "../cidades.ts";

/* "Avise-me quando houver fotógrafo na minha cidade" (QA do Muse, 18/10) — validação pura. */

export type AvisoValido = { ok: true; uf: string; chave: string; cidade: string; mensagem: string } | { ok: false; erro: string };

export const TITULO_SEM_FOTOGRAFO = (cidade: string) => `Ainda não temos fotógrafo parceiro em ${cidade.trim()}.`;
export const CONVITE_AVISO = "Deixe seu contato e avisamos quando houver fotógrafo na sua cidade.";
/**
 * Sem login (complemento do P29, item 5a): o login continua exigido — e-mail confirmado, sem spam, consentimento
 * claro. O link volta para a mesma busca com ?avisar=1 e o aviso é gravado então.
 */
export const TEXTO_AVISO_DESLOGADO = "Entre ou crie sua conta para ser avisado quando houver fotógrafo na sua cidade";
export const PARAM_AVISAR = "avisar";

/** Link de login que volta para a mesma busca e grava o aviso na volta. */
export function linkEntrarParaAvisar(voltarPara: string): string {
  const volta = `${voltarPara}${voltarPara.includes("?") ? "&" : "?"}${PARAM_AVISAR}=1`;
  return `/auth?redirect=${encodeURIComponent(volta)}`;
}

export function validarAvisoFotografo(entrada: { cidade?: unknown; uf?: unknown }): AvisoValido {
  const cidade = String(entrada.cidade ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const uf = String(entrada.uf ?? "").trim().toUpperCase();
  if (cidade.length < 2 || cidade.length > 80) return { ok: false, erro: "Informe a cidade." };
  if (!/^[A-Z]{2}$/.test(uf)) return { ok: false, erro: "Busque pelo CEP para sabermos a cidade e o estado." };
  const chave = chaveCidade(cidade);
  if (!chave || chave.length < 2) return { ok: false, erro: "Informe a cidade." };
  return { ok: true, uf, chave, cidade, mensagem: `Anotado! Avisamos você quando houver fotógrafo parceiro em ${cidade}.` };
}
