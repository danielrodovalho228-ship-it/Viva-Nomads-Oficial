"use client";

/*
  E425 — "Ativar minha página" no painel, para a conta do pedido aprovado ativar sem depender do link do e-mail.
  Mesmo núcleo do /parceiros/ativar (ativacao-nucleo): uso único, cria a página em rascunho e abre o painel completo.
*/
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ativarPeloPainel } from "@/lib/parceiros/ativacao-actions";
import { semQuedaDeRede } from "@/lib/erro-de-rede";

export function AtivarNoPainel() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="mt-4">
      <Button
        disabled={pendente}
        data-testid="parceiro-ativar-painel"
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            const r = await semQuedaDeRede(ativarPeloPainel());
            if (r.ok) {
              router.push("/dashboard/parceiro?ativada=1");
              router.refresh();
            } else setErro(r.erro);
          })
        }
      >
        {pendente && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Ativar minha página
      </Button>
      {erro && (
        <p className="mt-2 text-sm text-red-700" role="alert" data-testid="parceiro-ativar-painel-erro">
          {erro}
        </p>
      )}
    </div>
  );
}
