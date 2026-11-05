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

/** E520: texto digitado no campo de data que não é uma data real (incompleto ou inexistente, ex.: 31/02). Vazio não é. */
export function dataDigitadaInvalida(br: string): boolean {
  const t = (br ?? "").trim();
  return t.length > 0 && brParaIso(t) === null;
}

/** "2026-11-01" → "01/11/2026"; outra coisa → "". */
export function isoParaBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * E568: o texto do campo quando o VALOR muda de fora (calendário, rascunho, a outra caixa ligada à mesma seleção).
 * Exceção: enquanto a pessoa digita, o campo emite "" (data incompleta) e o pai devolve ""; isso NÃO é mudança de fora e
 * não pode apagar o que foi digitado — antes, a 1ª tecla num campo que já tinha data sumia ("10/01/2027" virava "00/12/027").
 */
export function textoAposMudancaDeFora(texto: string, valor: string): string {
  const atual = brParaIso(texto);
  if (atual === valor) return texto;
  if (valor === "" && atual === null) return texto; // digitando (incompleta ou inexistente): fica o que a pessoa escreveu
  return isoParaBr(valor);
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
