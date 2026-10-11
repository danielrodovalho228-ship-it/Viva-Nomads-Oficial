/**
 * Quem recebe cada tipo de aviso da equipe (ordem 27cfd36a). Puro, sem I/O.
 *  • "ceo": avisos do Moacir e decisões de CEO → só quem tem recebe_avisos_ceo (o Daniel).
 *  • "operacional": documento na fila, chamado, parceiro → admins que ligaram "receber alertas" na Conta.
 * Admin novo nasce com as duas marcas desligadas, então não recebe nada até alguém ligar.
 */
export type TipoAviso = "ceo" | "operacional";

export interface AdminDestino {
  id: string;
  role: string | null;
  recebe_avisos_ceo: boolean | null;
  recebe_alertas_operacionais: boolean | null;
}

export function escolherDestinatarios<T extends AdminDestino>(admins: readonly T[], tipo: TipoAviso): T[] {
  return admins.filter((a) => a.role === "admin" && (tipo === "ceo" ? a.recebe_avisos_ceo === true : a.recebe_alertas_operacionais === true));
}
