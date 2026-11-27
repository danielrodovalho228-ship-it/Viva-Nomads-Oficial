"use client";
/*
  E1229 (ORDEM-DUET-1160) — o botão da equipe no chamado que nasceu de um registro (o pedido de anulação do dono depois
  da confirmação do morador). Usa a mesma anulação (anularRegistroPelaCentral), que recusa o que já está anulado.
*/
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { semQuedaDeRede } from "@/lib/erro-de-rede";
import { anularRegistroPelaCentral } from "@/lib/data/anulacao-actions";

export function AnularRegistroCentral({ chamadoId }: { chamadoId: string }) {
  const router = useRouter();
  const enviando = useRef(false);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);

  async function anular() {
    if (enviando.current) return;
    enviando.current = true;
    setSaving(true);
    setErro(null);
    const r = await semQuedaDeRede(anularRegistroPelaCentral({ chamadoId, motivo }));
    setSaving(false);
    enviando.current = false;
    if (!r.ok) return setErro(r.error);
    setFeito(true);
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-white p-3" data-testid="central-anular">
      <p className="text-sm font-semibold text-red-800">Pedido de anulação de registro</p>
      {feito ? (
        <p className="mt-1 text-xs text-forest" role="status" data-testid="central-anulado">
          {/* PROPOSTA DE TEXTO */}
          Registro anulado. As duas partes foram avisadas e a anulação ficou na trilha do contrato.
        </p>
      ) : (
        <>
          <label className="mt-2 block text-xs text-muted">
            Motivo (vai para o morador)
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-sage-200 bg-white px-2 py-1 text-sm text-ink" data-testid="central-anular-motivo" />
          </label>
          {erro && <p className="mt-1 text-xs text-red-700" data-testid="central-anular-erro">{erro}</p>}
          <button type="button" onClick={anular} disabled={saving} className="mt-2 rounded-lg border border-red-700 bg-white px-3 py-1 text-xs font-semibold text-red-700" data-testid="central-anular-registro">
            Anular este registro
          </button>
        </>
      )}
    </div>
  );
}
