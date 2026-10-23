"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { alternarBuscaSalva, buscaEstaSalva } from "@/lib/data/buscas-salvas-actions";
import { cn } from "@/lib/utils";
import { normalizarBusca } from "@/lib/busca/buscas-salvas";
import { CHAVE_BUSCAS_CONVIDADO, alternarNaLista, lerLista } from "@/lib/convidado/guardados";
import { urlEntrada } from "@/lib/auth/entrada";

/** Prompt 49: buscas do convidado, no aparelho (null = sem armazenamento). */
function buscasDoAparelho(): string[] | null {
  try {
    return lerLista(window.localStorage.getItem(CHAVE_BUSCAS_CONVIDADO));
  } catch {
    return null;
  }
}
function guardarBuscasDoAparelho(lista: string[]): boolean {
  try {
    window.localStorage.setItem(CHAVE_BUSCAS_CONVIDADO, JSON.stringify(lista));
    return true;
  } catch {
    return false;
  }
}

/**
 * "Salvar busca" com coração (ordem d15ef6bf), como o "Save This Search" do
 * Furnished Finder: salva os filtros atuais da URL em Buscas salvas. Clicar de
 * novo remove. Prompt 49: o convidado salva no aparelho (vai para a conta quando ele entrar); sem armazenamento,
 * vai para a entrada ("Para salvar a busca…") e volta para a mesma busca.
 * `versao` muda quando os filtros mudam (reconsulta se a busca já está salva).
 */
export function SalvarBusca({ versao, className, qs, rotulo = "Salvar busca", rotuloSalva = "Busca salva" }: { versao: string; className?: string; qs?: string; rotulo?: string; rotuloSalva?: string }) {
  const router = useRouter();
  const [salva, setSalva] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const t = window.setTimeout(() => {
      const atual = qs ?? window.location.search;
      buscaEstaSalva(atual)
        .then((r) => {
          if (!vivo) return;
          // Convidado: vale o que está no aparelho.
          if (r.salva === null) setSalva((buscasDoAparelho() ?? []).includes(normalizarBusca(atual)));
          else setSalva(r.salva);
        })
        .catch(() => {});
    }, 400);
    return () => {
      vivo = false;
      window.clearTimeout(t);
    };
  }, [versao, qs]);

  async function alternar() {
    setAviso(null);
    setOcupado(true);
    const r = await alternarBuscaSalva(qs ?? window.location.search).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." }));
    setOcupado(false);
    if (!r.ok) {
      if ("precisaEntrar" in r && r.precisaEntrar) {
        const lista = buscasDoAparelho();
        const chave = normalizarBusca(qs ?? window.location.search);
        if (lista && chave) {
          const nova = alternarNaLista(lista, chave);
          if (guardarBuscasDoAparelho(nova)) {
            const agora = nova.includes(chave);
            setSalva(agora);
            setAviso(agora ? "Busca guardada neste aparelho. Entre com seu e-mail para receber alertas." : "Busca removida.");
            return;
          }
        }
        router.push(urlEntrada("busca", window.location.pathname + window.location.search));
        return;
      }
      setAviso(r.error);
      return;
    }
    setSalva(r.salva);
    setAviso(r.salva ? "Busca salva em Favoritos → Buscas salvas." : "Busca removida.");
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={() => void alternar()}
        disabled={ocupado}
        aria-pressed={!!salva}
        data-testid="salvar-busca"
        className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-2 py-2 text-sm font-semibold text-ink underline underline-offset-4 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest disabled:opacity-60"
      >
        <Heart className={cn("h-4 w-4", salva && "fill-forest text-forest")} aria-hidden />
        {salva ? rotuloSalva : rotulo}
      </button>
      {aviso && (
        <span role="status" className="text-xs text-muted">
          {aviso}
        </span>
      )}
    </span>
  );
}
