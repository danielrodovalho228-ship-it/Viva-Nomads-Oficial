import { chaveCidade } from "../cidades.ts";

/* "Avise-me quando houver fotógrafo na minha cidade" (QA do Muse, 18/10) — validação pura. */

export type AvisoValido = { ok: true; uf: string; chave: string; cidade: string; mensagem: string } | { ok: false; erro: string };

export const TITULO_SEM_FOTOGRAFO = (cidade: string) => `Ainda não temos fotógrafo parceiro em ${cidade.trim()}.`;
export const CONVITE_AVISO = "Deixe seu contato e avisamos quando houver fotógrafo na sua cidade.";

export function validarAvisoFotografo(entrada: { cidade?: unknown; uf?: unknown }): AvisoValido {
  const cidade = String(entrada.cidade ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const uf = String(entrada.uf ?? "").trim().toUpperCase();
  if (cidade.length < 2 || cidade.length > 80) return { ok: false, erro: "Informe a cidade." };
  if (!/^[A-Z]{2}$/.test(uf)) return { ok: false, erro: "Busque pelo CEP para sabermos a cidade e o estado." };
  const chave = chaveCidade(cidade);
  if (!chave || chave.length < 2) return { ok: false, erro: "Informe a cidade." };
  return { ok: true, uf, chave, cidade, mensagem: `Anotado! Avisamos você quando houver fotógrafo parceiro em ${cidade}.` };
}
