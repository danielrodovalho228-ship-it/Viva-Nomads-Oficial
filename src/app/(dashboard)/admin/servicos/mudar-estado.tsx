"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { atualizarEstadoPedidoServico } from "@/lib/data/servicos-morador-actions";
import { proximosEstados, rotuloEstado } from "@/lib/servicos-morador";

export function MudarEstado({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const proximos = proximosEstados(status);
  if (proximos.length === 0) return null;
  async function ir(novo: (typeof proximos)[number]) {
    setOcupado(true);
    setErro(null);
    const r = await atualizarEstadoPedidoServico(id, novo);
    setOcupado(false);
    if (!r.ok) return setErro(r.error ?? "Não foi possível mudar o estado.");
    router.refresh();
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {proximos.map((n) => (
        <Button key={n} size="sm" variant="secondary" disabled={ocupado} onClick={() => ir(n)}>
          {n === "cancelado" ? "Cancelar" : `Marcar: ${rotuloEstado(n)}`}
        </Button>
      ))}
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
    </div>
  );
}
