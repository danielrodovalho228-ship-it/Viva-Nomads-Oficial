"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { pausarImovelAdmin } from "@/lib/data/imoveis-admin-actions";

export function PausarImovel({ id }: { id: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <span>
      <ConfirmarNaPagina
        aviso="Pausar este anúncio? Ele sai da busca até o proprietário reativar."
        confirmar="Pausar"
        size="sm"
        testid="pausar-imovel"
        onConfirmar={async () => {
          const r = await pausarImovelAdmin(id);
          if (!r.ok) setErro(r.error ?? "Não foi possível pausar.");
          else router.refresh();
        }}
      >
        Pausar
      </ConfirmarNaPagina>
      {erro && <span className="ml-2 text-xs text-red-700">{erro}</span>}
    </span>
  );
}
