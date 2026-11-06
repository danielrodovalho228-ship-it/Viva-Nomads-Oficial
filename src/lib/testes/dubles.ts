/*
  Dublês dos testes de fluxo (E640). Só as PORTAS DE FORA são falsas — o código do app roda de verdade por cima delas.
  O teste põe o estado em globalThis.__dubles antes de importar o módulo do servidor.
*/
export interface EstadoDubles {
  /** O cliente "do usuário" (RLS) que createClient devolve. */
  usuario?: unknown;
  /** O cliente de serviço que createAdminClient devolve. */
  servico?: unknown;
  /** O que consumirLimite responde. */
  limiteLiberado?: boolean;
  /** Avisos enviados (notify). */
  avisos: Record<string, unknown>[];
  /** Admins que adminsPorAviso devolve. */
  admins: { email: string | null; full_name: string | null; notif_email: boolean | null }[];
}

type Global = typeof globalThis & { __dubles?: EstadoDubles };
const estado = (): EstadoDubles => {
  const g = globalThis as Global;
  g.__dubles ??= { avisos: [], admins: [] };
  return g.__dubles;
};

export const DIA = 24 * 60 * 60;
export const createClient = async () => (estado().usuario ?? null) as never;
export const createAdminClient = () => (estado().servico ?? null) as never;
export const consumirLimite = async () => estado().limiteLiberado !== false;
export const notify = async (p: Record<string, unknown>) => {
  estado().avisos.push(p);
};
export const adminsPorAviso = async () => estado().admins as never;
