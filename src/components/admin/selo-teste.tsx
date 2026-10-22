/** Selo "TESTE" das contas is_teste e dos anúncios [TESTE…] no admin (Prompt 29): o mesmo em todas as listas. */
export function SeloTeste({ className = "" }: { className?: string }) {
  return (
    <span className={`border border-line ml-2 rounded-full bg-white px-2 py-1 text-xs font-semibold text-amber-800 ${className}`} data-testid="selo-teste">
      TESTE
    </span>
  );
}
