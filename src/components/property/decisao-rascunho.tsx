"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { decidirRascunhoAjuda } from "@/lib/data/ajuda-publicacao-actions";

/** Ordem 65e999b2: o dono aprova o rascunho montado pela equipe ou pede ajustes. */
export function DecisaoRascunho({ id }: { id: string }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [decidido, setDecidido] = useState(false);
  const router = useRouter();

  async function decidir(decisao: "aprovado_dono" | "ajustes_pedidos") {
    setEnviando(true);
    setErro("");
    const r = await decidirRascunhoAjuda(id, decisao);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.error ?? "Não foi possível enviar agora.");
      return;
    }
    // Os botões somem na hora e a lista é recarregada, sem depender só da revalidação da ação.
    setDecidido(true);
    router.refresh();
  }

  if (decidido) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="decisao-rascunho">
      <Button size="sm" variant="gold" onClick={() => decidir("aprovado_dono")} disabled={enviando} data-testid="decisao-aprovar">
        Aprovar o rascunho
      </Button>
      <Button size="sm" variant="outline" onClick={() => decidir("ajustes_pedidos")} disabled={enviando} data-testid="decisao-ajustes">
        Pedir ajustes
      </Button>
      {erro && (
        <p className="w-full text-sm text-red-700" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
