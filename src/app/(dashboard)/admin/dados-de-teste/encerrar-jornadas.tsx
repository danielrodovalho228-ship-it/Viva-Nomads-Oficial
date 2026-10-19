"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { encerrarJornadasDeTeste } from "@/lib/data/jornada-teste-actions";

/** "Encerrar jornadas de teste" (Prompt 29, item 2): confirmação na página, resultado sempre escrito na tela. */
export function EncerrarJornadasTeste() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Encerra os contratos ativos de teste (anúncio [TESTE…] e inquilino de teste) de todos os anúncios de teste. Conta real nunca é tocada.
      </p>
      <ConfirmarNaPagina
        aviso="Encerrar todas as jornadas de teste ativas? Os contratos de teste ativos passam para encerrados."
        confirmar="Encerrar jornadas"
        testid="encerrar-jornadas"
        onConfirmar={async () => {
          const r = await encerrarJornadasDeTeste();
          setMsg(
            r.ok
              ? { ok: true, texto: `${r.encerrados} ${r.encerrados === 1 ? "contrato de teste encerrado" : "contratos de teste encerrados"} em ${r.anuncios} ${r.anuncios === 1 ? "anúncio" : "anúncios"} de teste.` }
              : { ok: false, texto: r.error }
          );
          router.refresh();
        }}
      >
        Encerrar jornadas de teste
      </ConfirmarNaPagina>
      {msg && (
        <p role="status" className={msg.ok ? "mt-3 text-sm text-forest" : "mt-3 text-sm text-red-700"} data-testid="encerrar-jornadas-resultado">
          {msg.texto}
        </p>
      )}
    </div>
  );
}
