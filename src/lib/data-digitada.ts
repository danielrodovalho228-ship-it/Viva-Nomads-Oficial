/*
  Prompt 22 (QA do Muse, item 6): "Disponível a partir de" não aceitava digitar nem colar (o campo de data nativo do
  computador é segmentado). No computador, as datas do cadastro viram um campo dd/mm/aaaa com máscara, que aceita
  colar em vários formatos, e o calendário continua num botão. No celular segue o seletor nativo (Q8/Q9).
  Valor sempre em ISO (AAAA-MM-DD), como o resto do app.
*/

/** "01112026" / "01/11/2026" → "01/11/2026" (só dígitos, até 8, com as barras no lugar). */
export function mascararData(entrada: string): string {
  const d = entrada.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join("/");
}

function isoValida(a: number, m: number, d: number): string | null {
  if (a < 1900 || a > 2200) return null;
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null; // 31/02 etc.
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "01/11/2026" → "2026-11-01"; incompleta ou inexistente → null. */
export function brParaIso(br: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim());
  return m ? isoValida(+m[3], +m[2], +m[1]) : null;
}

/** "2026-11-01" → "01/11/2026"; outra coisa → "". */
export function isoParaBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * Data COLADA: "01/11/2026", "1/11/2026", "01-11-2026", "01.11.2026", "2026-11-01" ou "01112026" → ISO.
 * Ano com 2 dígitos vira 20xx. Não reconheceu → null (a tela mantém o que estava).
 */
export function interpretarDataColada(texto: string): string | null {
  const t = texto.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(t);
  if (m) return isoValida(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2}|\d{4})$/.exec(t);
  if (m) return isoValida(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = /^(\d{2})(\d{2})(\d{4})$/.exec(t);
  if (m) return isoValida(+m[3], +m[2], +m[1]);
  return null;
}
