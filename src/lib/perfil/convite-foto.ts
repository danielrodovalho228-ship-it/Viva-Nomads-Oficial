/**
 * Convite gentil para a foto de perfil (ordem 504d9679, peça 1). NUNCA obrigatório:
 * o cartão só aparece quando não há foto e some por 7 dias após "Agora não".
 */
export const CONVITE_FOTO_TEXTO = "Perfis com foto passam mais confiança e profissionalismo";
export const CONVITE_FOTO_CHAVE = "viva:convite-foto-dispensado";
export const CONVITE_FOTO_DIAS = 7;

const DIA_MS = 24 * 60 * 60 * 1000;

export function deveMostrarConviteFoto(opts: {
  temFoto: boolean;
  /** Valor guardado no navegador (ISO ou ms); lixo/ausente = nunca dispensado. */
  dispensadoEm: string | null | undefined;
  agora?: number;
}): boolean {
  if (opts.temFoto) return false;
  const bruto = opts.dispensadoEm;
  if (!bruto) return true;
  const quando = /^\d+$/.test(bruto) ? Number(bruto) : Date.parse(bruto);
  if (!Number.isFinite(quando)) return true;
  const agora = opts.agora ?? Date.now();
  // Relógio voltou atrás: não esconde para sempre.
  if (quando > agora) return true;
  return agora - quando >= CONVITE_FOTO_DIAS * DIA_MS;
}
