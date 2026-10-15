/*
  Check-in garantido (ordem 404cd213, item 2): regras puras das instruções de entrada.
  O proprietário informa horário, como pegar a chave/acesso e um contato de plantão; o inquilino só
  vê depois que as duas partes assinaram (contato só depois do aceite). Sem imports de servidor.
  Roda: node --test src/lib/checkin.test.ts
*/

export const STATUS_CHECKIN = ["ativo"] as const;

export const LIMITE_INSTRUCOES = 600;
export const MINIMO_INSTRUCOES = 10;

export interface InstrucoesEntrada {
  horario: string;
  instrucoes: string;
  plantao: string;
}

export const MSG_ABRIU_ACESSO =
  "Não consegui entrar no imóvel. Preciso de ajuda agora para acessar o imóvel do meu contrato (chave, senha ou fechadura).";

const HORARIO_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Telefone de plantão: só dígitos, com DDD (10 a 13 dígitos, aceitando +55, espaços, parênteses e traço). */
export function normalizarTelefone(txt: string): string | null {
  const limpo = (txt ?? "").replace(/[\s().-]/g, "").replace(/^\+/, "");
  if (!/^\d{10,13}$/.test(limpo)) return null;
  return limpo;
}

export function validarInstrucoes(
  entrada: Partial<Record<keyof InstrucoesEntrada, unknown>>
): { ok: true; dados: InstrucoesEntrada } | { ok: false; erro: string } {
  const horario = typeof entrada.horario === "string" ? entrada.horario.trim() : "";
  const instrucoes = typeof entrada.instrucoes === "string" ? entrada.instrucoes.replace(/\r\n/g, "\n").trim() : "";
  const plantaoTxt = typeof entrada.plantao === "string" ? entrada.plantao.trim() : "";
  if (!HORARIO_RE.test(horario)) return { ok: false, erro: "Informe o horário de entrada no formato 14:00." };
  if (instrucoes.length < MINIMO_INSTRUCOES) return { ok: false, erro: "Explique como o inquilino pega a chave ou o acesso (mínimo de 10 letras)." };
  if (instrucoes.length > LIMITE_INSTRUCOES) return { ok: false, erro: `Instruções longas demais (máx. ${LIMITE_INSTRUCOES} caracteres).` };
  const plantao = normalizarTelefone(plantaoTxt);
  if (!plantao) return { ok: false, erro: "Informe um telefone de plantão com DDD (ex.: 34 99999-0000)." };
  return { ok: true, dados: { horario, instrucoes, plantao } };
}

export interface ContratoCheckin {
  status: string;
  papel: "inquilino" | "proprietario";
  assinadoProprietarioEm?: string | null;
  assinadoInquilinoEm?: string | null;
}

const assinadoPorAmbos = (c: ContratoCheckin) => !!c.assinadoProprietarioEm && !!c.assinadoInquilinoEm;

/** O proprietário preenche/edita enquanto o contrato está ativo (antes e durante a entrada). */
export function podeEditarInstrucoes(c: ContratoCheckin): boolean {
  return c.papel === "proprietario" && (STATUS_CHECKIN as readonly string[]).includes(c.status);
}

/** O inquilino só enxerga as instruções (e o telefone) depois das duas assinaturas — contato só após o aceite. */
export function inquilinoVeInstrucoes(c: ContratoCheckin): boolean {
  return c.papel === "inquilino" && (STATUS_CHECKIN as readonly string[]).includes(c.status) && assinadoPorAmbos(c);
}

/** "Não consegui entrar": só o inquilino, com o contrato ativo assinado pelas duas partes. */
export function podeNaoConsegui(c: ContratoCheckin): boolean {
  return c.papel === "inquilino" && (STATUS_CHECKIN as readonly string[]).includes(c.status) && assinadoPorAmbos(c);
}

export function telefoneParaExibir(digitos: string): string {
  const d = digitos.replace(/\D/g, "");
  const nacional = d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
  if (nacional.length === 11) return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  if (nacional.length === 10) return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  return d;
}
