/**
 * Destino de redirecionamento SEGURO (A7 — open redirect).
 *
 * Só aceita caminho INTERNO do próprio site. Recusa:
 *  - qualquer coisa que não comece com "/" (https://evil.com, @evil.com,
 *    .evil.com, javascript:…);
 *  - "//evil.com" e "/\evil.com" (viram endereço de outro site);
 *  - caracteres de controle (tab/CR/LF): o navegador os descarta ao montar a
 *    URL e "/\t/evil.com" vira "//evil.com";
 *  - qualquer coisa que, montada sobre uma origem qualquer, saia dela.
 * Devolve o caminho normalizado (pathname + query + hash) ou o `fallback`.
 */
export function safeInternalPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (/[\u0000-\u001F\u007F\\]/.test(raw)) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  let u: URL;
  try {
    u = new URL(raw, "https://interno.invalid");
  } catch {
    return fallback;
  }
  if (u.origin !== "https://interno.invalid") return fallback;
  const caminho = u.pathname + u.search + u.hash;
  return caminho.startsWith("//") ? fallback : caminho;
}
