/**
 * Evento "uma vez por sessão do navegador": o funil conta sessões, não
 * remontagens da tela. Guarda a marca no sessionStorage; se ele estiver
 * bloqueado, não bloqueia o evento (conta a mais, nunca a menos).
 */
export interface ArmazemSessao {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

export function primeiraVezNaSessao(armazem: ArmazemSessao | null | undefined, tipo: string): boolean {
  const chave = `vn_evento_${tipo}`;
  try {
    if (!armazem) return true;
    if (armazem.getItem(chave)) return false;
    armazem.setItem(chave, "1");
    return true;
  } catch {
    return true;
  }
}
