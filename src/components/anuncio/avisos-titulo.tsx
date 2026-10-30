"use client";

import { avisosConsistenciaTitulo } from "@/lib/anuncio/titulo-bairro";

/**
 * F17 + E150: o título confere com o bairro, o tipo e os quartos do anúncio (aviso que pode manter, nunca trava).
 * E261: o mesmo bloco no Passo 7 do assistente e no editor do anúncio já publicado.
 */
export function AvisosConsistenciaTitulo({ titulo, bairro, tipo, quartos }: { titulo: string; bairro: string; tipo?: string; quartos?: string }) {
  const avisos = avisosConsistenciaTitulo(titulo, { bairro, tipo, quartos });
  return avisos.length ? (
    <div role="status" className="mt-1 space-y-1 text-xs text-amber-700" data-testid="aviso-titulo-consistencia">
      {avisos.map((a) => (
        <p key={a} data-testid={a.startsWith("O título cita") ? "aviso-titulo-bairro" : undefined}>
          {a}
        </p>
      ))}
    </div>
  ) : null;
}
