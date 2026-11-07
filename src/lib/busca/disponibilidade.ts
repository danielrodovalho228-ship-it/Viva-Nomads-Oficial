/* Data de disponibilidade do card (ordem 314f764e) — puro. */
/** "15/11/2026" quando o imóvel só libera numa data futura (E702: o ano SEMPRE, em todo cartão); nada quando já está livre. */
export function disponivelAPartirDe(iso: string | undefined, hoje = new Date()): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  const hojeIso = hoje.toISOString().slice(0, 10);
  if (iso.slice(0, 10) <= hojeIso) return null;
  return `${d}/${m}/${y}`;
}
