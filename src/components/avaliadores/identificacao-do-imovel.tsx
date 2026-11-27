/**
 * E1108 (ORDEM-DUET-491): de que imóvel é o pedido — "Título do anúncio · VN-XXXXXX" (o texto de identificacaoDoImovel).
 * Um lugar só para a tela do pedido, a tela da visita e a linha da lista. O código VN nunca quebra de linha (em telas
 * estreitas o hífen partia "VN-" de um lado e o resto do outro).
 */
export function IdentificacaoDoImovel({ texto, className = "" }: { texto: string; className?: string }) {
  const corte = texto.lastIndexOf(" · ");
  const titulo = corte < 0 ? "" : texto.slice(0, corte + 3);
  const codigo = corte < 0 ? texto : texto.slice(corte + 3);
  return (
    <p className={`break-words font-semibold text-ink ${className}`.trim()} data-testid="pedido-imovel">
      {titulo}
      <span className="whitespace-nowrap">{codigo}</span>
    </p>
  );
}
