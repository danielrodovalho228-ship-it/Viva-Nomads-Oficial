import { AVISO_TESTES } from "@/lib/aviso-testes";

/** Aviso único de fase de testes, mostrado no topo de todas as páginas públicas. */
export function AvisoTestes() {
  return (
    <p className="bg-night px-4 py-2 text-center text-xs font-medium text-white sm:text-sm" data-testid="aviso-testes">
      {AVISO_TESTES}
    </p>
  );
}
