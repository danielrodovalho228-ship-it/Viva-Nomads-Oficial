"use client";
/*
  E1229 (ORDENS-DUET 1143 e 1160) — o botão do dono para anular um registro de pagamento. Antes da confirmação do
  morador, "Anular registro"; depois, "Pedir anulação à Central" (a ação abre o pedido). O motivo é obrigatório e vai
  para o morador. A regra é a da ação (anularRegistro); a tela só pede o motivo e mostra a resposta.
*/
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { semQuedaDeRede } from "@/lib/erro-de-rede";
import { anularRegistro } from "@/lib/data/anulacao-actions";

export function AnularRegistro({ pagamentoId, confirmado }: { pagamentoId: string; confirmado: boolean }) {
  const router = useRouter();
  const enviando = useRef(false);
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  async function enviar() {
    if (enviando.current) return;
    enviando.current = true;
    setSaving(true);
    setErro(null);
    const r = await semQuedaDeRede(anularRegistro({ pagamentoId, motivo }));
    setSaving(false);
    enviando.current = false;
    if (!r.ok) return setErro(r.error);
    // PROPOSTA DE TEXTO
    setFeito(r.mensagem ?? "Registro anulado. O morador foi avisado com o motivo.");
    setAberto(false);
    if (!r.pedido) router.refresh();
  }

  if (feito) return <p className="mt-1 text-xs text-forest" role="status" data-testid="anular-feito">{feito}</p>;
  if (!aberto)
    return (
      <button type="button" onClick={() => setAberto(true)} className="text-xs font-medium text-red-700 underline" data-testid="anular-registro">
        {confirmado ? "Pedir anulação à Central" : "Anular registro"}
      </button>
    );
  return (
    <div className="mt-2 w-full rounded-lg border border-sage-200 p-2" data-testid="anular-formulario">
      <label className="block text-xs text-muted">
        {/* PROPOSTA DE TEXTO */}
        Motivo da anulação (o morador vê este texto)
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={500}
          rows={2}
          className="mt-1 w-full rounded-lg border border-sage-200 px-2 py-1 text-sm text-ink"
          data-testid="anular-motivo"
        />
      </label>
      {erro && <p className="mt-1 text-xs text-red-600" data-testid="anular-erro">{erro}</p>}
      <div className="mt-2 flex gap-3">
        <button type="button" onClick={enviar} disabled={saving} className="text-xs font-semibold text-red-700 underline" data-testid="anular-confirmar">
          {confirmado ? "Enviar o pedido" : "Anular"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="text-xs text-muted underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}
