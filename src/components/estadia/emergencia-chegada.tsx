"use client";

import { useState } from "react";
import { Loader2, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acionarEmergenciaChegada } from "@/lib/data/emergencia-chegada-actions";
import { ROTULO_BOTAO_EMERGENCIA } from "@/lib/estadia/emergencia-chegada";

/**
 * E664 — botão de emergência do dia da chegada, dentro da conversa. Só aparece quando o servidor diz que hoje é o dia da
 * entrada do morador. Avisa o proprietário com urgência; nenhum telefone é mostrado nem trocado.
 */
export function EmergenciaChegada({ contratoId }: { contratoId: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  async function acionar() {
    if (ocupado) return;
    setOcupado(true);
    setResultado(null);
    try {
      const r = await acionarEmergenciaChegada(contratoId);
      setResultado({ ok: r.ok, texto: (r.ok ? r.mensagem : r.error) ?? "Não foi possível enviar o aviso agora. Tente de novo." });
    } catch {
      setResultado({ ok: false, texto: "Sem conexão. Tente de novo." });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="border-b border-line bg-amber-50 px-4 py-3" data-testid="emergencia-chegada">
      <p className="text-sm text-ink">Hoje é o dia da sua entrada. Se precisar falar com o proprietário agora, avise por aqui: a Viva acompanha.</p>
      <Button type="button" onClick={acionar} disabled={ocupado} className="mt-2 min-h-11" data-testid="emergencia-chegada-botao">
        {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Siren className="h-4 w-4" aria-hidden />} {ROTULO_BOTAO_EMERGENCIA}
      </Button>
      {resultado && (
        <p role={resultado.ok ? "status" : "alert"} className={`mt-2 text-sm ${resultado.ok ? "text-forest" : "text-red-700"}`} data-testid="emergencia-chegada-resultado">
          {resultado.texto}
        </p>
      )}
    </div>
  );
}
