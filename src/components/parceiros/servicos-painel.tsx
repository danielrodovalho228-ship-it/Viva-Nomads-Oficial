import Link from "next/link";
import { Wrench } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { CATEGORIAS_CATALOGO } from "@/lib/parceiros/regras";

/** Prompt 31a: seção "Serviços" dos painéis do inquilino e do dono — a busca de parceiros com a cidade preenchida. */
export function ServicosPainel({ cidade }: { cidade?: string | null }) {
  const q = (categoria: string) => `/parceiros/buscar?${new URLSearchParams({ categoria, ...(cidade ? { cidade } : {}) }).toString()}`;
  const lista = CATEGORIAS_CATALOGO.filter((c) => c.valor !== "outro");
  return (
    <Panel title="Serviços" className="mt-6" data-testid="painel-servicos-parceiros">
      <p className="flex items-center gap-2 text-sm text-muted">
        <Wrench className="h-4 w-4 shrink-0" aria-hidden /> Parceiros aprovados pela Viva{cidade ? ` em ${cidade}` : ""}. Você combina tudo pelas mensagens da Viva.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {lista.map((c) => (
          <li key={c.valor}>
            <Link href={q(c.valor)} className="flex h-11 items-center justify-center rounded-lg border border-line bg-white px-2 text-sm font-semibold text-ink hover:border-blue-500" data-testid={`servicos-${c.valor}`}>
              {c.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
