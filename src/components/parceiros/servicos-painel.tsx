import Image from "next/image";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { CATEGORIAS_CATALOGO } from "@/lib/parceiros/regras";
import { fotoDaCategoria } from "@/config/fotos-categorias-parceiro";
import { BRAND_BLUR } from "@/lib/media";

/** E276 (mockup aprovado em 30/10): os 3 passos do pedido de serviço, o mesmo caminho de sempre. */
export const COMO_FUNCIONA_SERVICOS = [
  { titulo: "Escolha o serviço", texto: "Veja os parceiros aprovados pela Viva na sua cidade." },
  { titulo: "Peça o orçamento", texto: "Pela página do parceiro, com o que você precisa." },
  { titulo: "Combine pela Viva", texto: "Data, valor e detalhes ficam registrados nas mensagens." },
] as const;

/**
 * Prompt 31a: seção "Serviços" dos painéis do inquilino e do dono — a busca de parceiros com a cidade preenchida.
 * E276 (mockup aprovado): cada serviço é um cartão com a FOTO real da categoria no topo (16:10, todas do mesmo tamanho),
 * o nome e uma frase curta; grade par (2 colunas no celular, 3 no computador); embaixo, a faixa "Como funciona" em 3
 * passos. O destino de cada cartão não mudou.
 */
export function ServicosPainel({ cidade }: { cidade?: string | null }) {
  const q = (categoria: string) => `/parceiros/buscar?${new URLSearchParams({ categoria, ...(cidade ? { cidade } : {}) }).toString()}`;
  const lista = CATEGORIAS_CATALOGO.filter((c) => c.valor !== "outro");
  return (
    <Panel title="Serviços" className="mt-6" data-testid="painel-servicos-parceiros">
      <p className="flex items-center gap-2 text-sm text-muted">
        <Wrench className="h-4 w-4 shrink-0" aria-hidden /> Parceiros aprovados pela Viva{cidade ? ` em ${cidade}` : ""}. Você combina tudo pelas mensagens da Viva.
      </p>
      <ul className="mt-4 grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4" data-testid="servicos-grade">
        {lista.map((c) => {
          const foto = fotoDaCategoria(c.valor);
          return (
            <li key={c.valor}>
              <Link
                href={q(c.valor)}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-white outline-none transition-colors hover:border-forest focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
                data-testid={`servicos-${c.valor}`}
              >
                <span className="relative block aspect-[16/10] overflow-hidden bg-surface-2" data-testid="servicos-foto">
                  {foto && (
                    <Image
                      src={foto.src}
                      alt={foto.alt}
                      fill
                      sizes="(min-width: 640px) 260px, 45vw"
                      placeholder="blur"
                      blurDataURL={BRAND_BLUR}
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                </span>
                <span className="flex flex-1 flex-col gap-1 p-3">
                  <span className="text-sm font-semibold text-ink group-hover:text-forest">{c.rotulo}</span>
                  {foto && <span className="text-xs text-muted" data-testid="servicos-frase">{foto.frase}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 border-t border-line pt-4" data-testid="servicos-como-funciona">
        <h3 className="text-sm font-semibold text-ink">Como funciona</h3>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-4">
          {COMO_FUNCIONA_SERVICOS.map((p, i) => (
            <li key={p.titulo} className="flex gap-3 rounded-xl bg-surface-2 p-3" data-testid="servicos-passo">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest text-xs font-semibold text-white" aria-hidden>
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{p.titulo}</span>
                <span className="block text-xs text-muted">{p.texto}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}
