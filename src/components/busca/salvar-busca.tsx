"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { alternarBuscaSalva, buscaEstaSalva } from "@/lib/data/buscas-salvas-actions";
import { cn } from "@/lib/utils";

/**
 * "Salvar busca" com coração (ordem d15ef6bf), como o "Save This Search" do
 * Furnished Finder: salva os filtros atuais da URL em Buscas salvas. Clicar de
 * novo remove. Visitante vai para o login e volta para a mesma busca.
 * `versao` muda quando os filtros mudam (reconsulta se a busca já está salva).
 */
export function SalvarBusca({ versao, className }: { versao: string; className?: string }) {
  const router = useRouter();
  const [salva, setSalva] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const t = window.setTimeout(() => {
      buscaEstaSalva(window.location.search)
        .then((r) => vivo && setSalva(r.salva))
        .catch(() => {});
    }, 400);
    return () => {
      vivo = false;
      window.clearTimeout(t);
    };
  }, [versao]);

  async function alternar() {
    setAviso(null);
    setOcupado(true);
    const r = await alternarBuscaSalva(window.location.search).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." }));
    setOcupado(false);
    if (!r.ok) {
      if ("precisaEntrar" in r && r.precisaEntrar) {
        router.push(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
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
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-semibold text-blue-500 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
      >
        <Heart className={cn("h-4 w-4", salva && "fill-current")} aria-hidden />
        {salva ? "Busca salva" : "Salvar busca"}
      </button>
      {aviso && (
        <span role="status" className="text-xs text-muted">
          {aviso}
        </span>
      )}
    </span>
  );
}
