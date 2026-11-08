import Link from "next/link";
import { PASSOS_MORADOR } from "@/config/caminho-reserva";

/**
 * E530: "Ver o caminho para morar" — sempre visível na página do imóvel (visitante ou logado, anúncio real ou de exemplo,
 * desktop e celular), sem depender de escolher datas. Abre ali mesmo os passos do morador (a mesma fonte do Como funciona)
 * e leva ao passo a passo completo.
 */
export function CaminhoReserva() {
  return (
    <details className="mb-3 rounded-xl border border-line bg-white px-4 text-sm" data-testid="caminho-reserva">
      <summary className="min-h-11 cursor-pointer py-3 font-medium text-forest underline">Ver o caminho para morar</summary>
      <ol className="mb-2 list-inside list-decimal space-y-1 text-ink" data-testid="caminho-reserva-passos">
        {PASSOS_MORADOR.map((p) => (
          <li key={p.titulo}>
            <span className="font-semibold">{p.titulo}:</span> {p.texto}
          </li>
        ))}
      </ol>
      <Link href="/como-funciona#para-inquilinos" className="mb-3 inline-block font-medium text-forest underline">
        Como funciona, passo a passo
      </Link>
    </details>
  );
}
