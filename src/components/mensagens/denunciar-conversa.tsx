"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { denunciarConversa } from "@/lib/data/denuncia-conversa-actions";
import { NOTA_DENUNCIA_MAX } from "@/lib/atendimento/denuncia-mensagem";

/**
 * "Denunciar mensagem suspeita" (ordem 404cd213, item 3). Abre um chamado de segurança com o id da
 * conversa; em modo demonstração não grava nada.
 */
export function DenunciarConversa({ conversationId, demo }: { conversationId: string; demo: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [numero, setNumero] = useState<string | null>(null);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    if (demo) {
      setNumero("demonstração");
      setEnviando(false);
      return;
    }
    const r = await denunciarConversa({ conversationId, nota });
    setEnviando(false);
    if (r.ok) setNumero(r.numero);
    else setErro(r.error);
  }

  if (numero) {
    return (
      <p data-testid="denuncia-enviada" role="status" className="border-t border-sage-200 bg-sage-50 px-4 py-2 text-xs text-ink">
        Recebemos sua denúncia ({numero}). A equipe da Viva Nomads vai olhar a conversa. Enquanto isso, não pague nem passe senhas ou códigos por fora da plataforma.
      </p>
    );
  }

  return (
    <div className="border-t border-sage-200 px-4 py-2">
      {!aberto ? (
        <button
          type="button"
          data-testid="denunciar-abrir"
          onClick={() => setAberto(true)}
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-muted hover:text-ink"
        >
          <Flag className="h-3.5 w-3.5" aria-hidden /> Denunciar mensagem suspeita
        </button>
      ) : (
        <div data-testid="denunciar-painel" className="space-y-2">
          <label htmlFor="denuncia-nota" className="block text-xs font-medium text-ink">
            O que pareceu suspeito? (opcional)
          </label>
          <textarea
            id="denuncia-nota"
            data-testid="denunciar-nota"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={NOTA_DENUNCIA_MAX}
            rows={3}
            placeholder="Ex.: pediu pagamento por fora, link estranho…"
            className="w-full rounded-lg border border-sage-200 px-3 py-2 text-sm outline-none focus:border-sage"
          />
          {erro && (
            <p role="alert" className="text-xs text-red-700">
              {erro}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" data-testid="denunciar-enviar" disabled={enviando} onClick={enviar} className="min-h-11">
              {enviando ? "Enviando…" : "Enviar denúncia"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setAberto(false)} className="min-h-11">
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
