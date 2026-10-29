/**
 * Pendência 3 do QA-LOGIN-B v2: no lugar dos botões de uma linha que o admin observador da QA não pode decidir (dado
 * real), uma linha dizendo isso. O servidor continua recusando (recusaObservador); aqui a tela só deixa de oferecer.
 */
export const TEXTO_SO_LEITURA_QA = "Só leitura: a conta de QA não decide dado real.";

export function SoLeituraQa({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted ${className}`} data-testid="so-leitura-qa">
      {TEXTO_SO_LEITURA_QA}
    </p>
  );
}
