/**
 * E608: a marca de obrigatório dos Passos 1–5 do cadastro — um asterisco visível e, para o leitor de tela,
 * "obrigatório para publicar". A obrigatoriedade é a da prontidão (a única regra de "pode publicar"); antes ela só
 * aparecia pelo "Continuar" esmaecido ou pelo "Falta para publicar" da listagem, longe de onde se preenche.
 */
export const LEGENDA_OBRIGATORIO = "Campos com * são obrigatórios para publicar.";

export function MarcaObrigatorio({ ativo = true }: { ativo?: boolean }) {
  if (!ativo) return null;
  return (
    <span data-testid="marca-obrigatorio">
      <span aria-hidden className="ml-1 font-semibold text-red-700">
        *
      </span>
      <span className="sr-only"> (obrigatório para publicar)</span>
    </span>
  );
}

/** A linha que explica o asterisco, no topo de cada passo que tem campo obrigatório. */
export function LegendaObrigatorio() {
  return (
    <p className="mt-2 text-xs text-muted" data-testid="legenda-obrigatorio">
      {LEGENDA_OBRIGATORIO}
    </p>
  );
}
