/*
  E293 P7 — erro de fornecedor sem o corpo da resposta. O corpo de erro da CAF, do Asaas, da ZapSign e da NFS-e pode
  repetir o que mandamos (nome, CPF, e-mail, endereço) e ia inteiro para a mensagem do erro e daí para o log. Agora a
  mensagem leva só o fornecedor, o status HTTP e, quando vier, o CÓDIGO do erro (identificador curto, sem espaço). PURO.
  Roda: node --test src/lib/integrations/erro-fornecedor.test.ts
*/

/** Código de erro do fornecedor: identificador curto (letras, números, _ . -), nunca frase nem dado. */
const CODIGO = /^[A-Za-z][A-Za-z0-9_.-]{1,59}$/;

function codigoDe(v: unknown): string | null {
  return typeof v === "string" && CODIGO.test(v) ? v : null;
}

/** O código do erro no corpo (JSON): `code`, `error_code`, `errorCode`, `errors[0].code` ou `error.code`. */
export function codigoDoErro(corpo: string): string | null {
  let j: unknown;
  try {
    j = JSON.parse(corpo);
  } catch {
    return null;
  }
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  const lista = Array.isArray(o.errors) ? o.errors : [];
  const primeiro = lista[0] && typeof lista[0] === "object" ? (lista[0] as Record<string, unknown>) : null;
  const erro = o.error && typeof o.error === "object" ? (o.error as Record<string, unknown>) : null;
  return codigoDe(o.code) ?? codigoDe(o.error_code) ?? codigoDe(o.errorCode) ?? codigoDe(primeiro?.code) ?? codigoDe(erro?.code) ?? null;
}

/** "CAF 422 (invalid_document)" — sem o corpo da resposta. */
export function erroDoFornecedor(fornecedor: string, status: number, corpo: string): Error {
  const codigo = codigoDoErro(corpo);
  return new Error(`${fornecedor} ${status}${codigo ? ` (${codigo})` : ""}`);
}
