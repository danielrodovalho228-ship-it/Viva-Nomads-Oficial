"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Heart, Trash2 } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { apagarBuscaSalva, definirAlertaBusca, type BuscaSalva } from "@/lib/data/buscas-salvas-actions";

/** Buscas salvas da pessoa (ordem d15ef6bf): abrir de novo ou apagar. */
export function ListaBuscasSalvas({ inicial }: { inicial: BuscaSalva[] }) {
  const [buscas, setBuscas] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);

  async function apagar(id: string) {
    setErro(null);
    const r = await apagarBuscaSalva(id).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." }));
    if (!r.ok) return setErro(r.error);
    setBuscas((b) => b.filter((x) => x.id !== id));
  }

  async function alternarAlerta(b: BuscaSalva) {
    setErro(null);
    const r = await definirAlertaBusca(b.id, !b.alertaAtivo).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." }));
    if (!r.ok) return setErro(r.error);
    setBuscas((l) => l.map((x) => (x.id === b.id ? { ...x, alertaAtivo: r.ativo } : x)));
  }

  return (
    <div className="grid gap-3" data-testid="buscas-salvas">
      {erro && (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      )}
      {buscas.map((b) => (
        <Panel key={b.id} className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/buscar${b.parametros ? `?${b.parametros}` : ""}`} className="flex min-w-0 items-center gap-2 font-medium text-ink hover:text-blue-500">
            <Heart className="h-4 w-4 shrink-0 fill-current text-blue-500" aria-hidden />
            <span className="break-words">{b.resumo}</span>
          </Link>
          <button
            type="button"
            onClick={() => void alternarAlerta(b)}
            aria-pressed={b.alertaAtivo}
            data-testid="alerta-busca-botao"
            aria-label={`${b.alertaAtivo ? "Desligar" : "Ligar"} o alerta por e-mail da busca ${b.resumo}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-sage-100 px-3 py-1.5 text-sm font-medium text-forest"
          >
            {b.alertaAtivo ? <Bell className="h-4 w-4" aria-hidden /> : <BellOff className="h-4 w-4" aria-hidden />}
            {b.alertaAtivo ? "Alerta ligado" : "Alerta desligado"}
          </button>
          <button
            type="button"
            onClick={() => void apagar(b.id)}
            aria-label={`Apagar a busca ${b.resumo}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Apagar
          </button>
        </Panel>
      ))}
    </div>
  );
}
