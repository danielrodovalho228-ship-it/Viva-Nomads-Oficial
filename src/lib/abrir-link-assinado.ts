/** Janela mínima que precisamos de `window.open` (facilita testar sem navegador). */
export type JanelaAberta = { opener: unknown; location: { href: string }; close: () => void };

/**
 * Abre um link que só existe depois de uma chamada ao servidor (ex.: link assinado de 10 min).
 * A aba tem de ser aberta ANTES do `await`, no clique: depois dele o Safari/iOS bloqueia o pop-up.
 * `opener` é zerado à mão (equivale ao noopener) e a aba só segue para o link depois que ele chega.
 */
export async function abrirLinkAssinado(
  abrir: () => JanelaAberta | null,
  buscar: () => Promise<{ ok: boolean; url?: string; error?: string }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const aba = abrir();
  if (aba) aba.opener = null;
  const r = await buscar().catch(() => ({ ok: false, url: undefined, error: undefined }));
  if (r.ok && r.url) {
    if (aba) aba.location.href = r.url;
    else return { ok: false, error: "O navegador bloqueou a nova aba. Libere pop-ups para o Viva Nomads e tente de novo." };
    return { ok: true };
  }
  aba?.close();
  return { ok: false, error: r.error || "Não foi possível abrir agora." };
}
