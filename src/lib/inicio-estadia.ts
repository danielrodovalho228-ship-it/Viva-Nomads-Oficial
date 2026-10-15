/*
  Data de início da estadia no Fechamento (ordem 02d4c903/c4530769, F37).
  Regra pura, sem banco: a tela e o servidor usam a mesma validação. Os blocos, os prazos de
  pagamento e o fim da estadia partem desta data.
*/
import { addDiasISO } from "./contrato-blocos.ts";

export const INICIO_MAX_DIAS_A_FRENTE = 365;

export type InicioValido = { ok: true } | { ok: false; error: string };

function dataExiste(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** `hoje` é AAAA-MM-DD no horário de Brasília (hojeBR). Hoje vale; passado não. */
export function validarInicioEstadia(inicioISO: unknown, hoje: string): InicioValido {
  const v = typeof inicioISO === "string" ? inicioISO.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !dataExiste(v)) {
    return { ok: false, error: "Informe a data de início da estadia." };
  }
  if (v < hoje) return { ok: false, error: "A data de início não pode ser no passado." };
  if (v > addDiasISO(hoje, INICIO_MAX_DIAS_A_FRENTE)) {
    return { ok: false, error: "A data de início está longe demais (máximo de 1 ano à frente)." };
  }
  return { ok: true };
}
