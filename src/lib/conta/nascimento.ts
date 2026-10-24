/*
  A4 — Conta › Meus dados (mockup perfil-04): "Data de nascimento" como desenhada (dd/mm/aaaa).
  Só confere que é uma data de verdade, no passado e depois de 1900; nenhuma regra de idade (não está decidida).
*/

/** Máscara enquanto digita: só dígitos, "dd/mm/aaaa". */
export function mascararNascimento(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "aaaa-mm-dd" → "dd/mm/aaaa"; outra coisa → "". */
export function nascimentoParaTela(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** "dd/mm/aaaa" → "aaaa-mm-dd". Vazio = sem data (ok, campo opcional). */
export function validarNascimento(v: string, hoje: Date = new Date()): { ok: true; iso: string | null } | { ok: false; erro: string } {
  const t = v.trim();
  if (!t) return { ok: true, iso: null };
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return { ok: false, erro: "Use o formato dd/mm/aaaa." };
  const [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return { ok: false, erro: "Data de nascimento inválida." };
  if (ano < 1900 || data.getTime() > Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) return { ok: false, erro: "Data de nascimento inválida." };
  return { ok: true, iso: `${m[3]}-${m[2]}-${m[1]}` };
}
