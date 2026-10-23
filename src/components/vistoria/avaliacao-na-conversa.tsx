"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { concordarVisita } from "@/lib/vistoria/actions";
import { avaliacaoNaConversa, type AvaliacaoNaConversa } from "@/lib/vistoria/conversa-actions";
import { ETIQUETA_BRASILIA } from "@/lib/datas-brasilia";

/**
 * Prompt 62-A, Parte 1, item 5 — o cartão da visita de avaliação na conversa da estadia (só o morador do imóvel ocupado
 * vê). "Prefiro outro horário" escreve o pedido na caixa de mensagem da própria conversa: a data nova é combinada ali.
 * A caixa fica sempre montada e só troca o conteúdo ao mudar de conversa (mesma lição do cartão de visita, t270).
 */
export function AvaliacaoNaConversaCartao({ propertyId, onPreferirOutro }: { propertyId: string; onPreferirOutro: () => void }) {
  const [carregada, setCarregada] = useState<{ chave: string; a: AvaliacaoNaConversa | null } | null>(null);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  useEffect(() => {
    let vivo = true;
    avaliacaoNaConversa(propertyId)
      .then((a) => {
        if (vivo) setCarregada({ chave: propertyId, a });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [propertyId, versao]);
  const a = carregada?.chave === propertyId ? carregada.a : null;
  return (
    <div data-conversa-avaliacao-caixa={propertyId} hidden={!a}>
      {a && (
        <div className="border-b border-line bg-white px-4 py-3 text-sm" data-testid="conversa-avaliacao" data-confirmada={a.confirmada ? "1" : "0"}>
          <p className="font-semibold text-ink">Visita de avaliação do imóvel</p>
          {a.confirmada ? (
            <p className="mt-1 text-forest" data-testid="conversa-avaliacao-confirmada">
              Você concordou com a visita em {a.quando} ({ETIQUETA_BRASILIA}).
            </p>
          ) : (
            <>
              <p className="mt-1 text-muted">O avaliador não fotografa os seus pertences. A visita só acontece se você concordar.</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pendente}
                  data-testid="conversa-concordar"
                  onClick={() =>
                    iniciar(async () => {
                      setErro(null);
                      const f = new FormData();
                      f.set("pedidoId", a.pedidoId);
                      const r = await concordarVisita(f);
                      if (!r.ok) setErro(r.erro);
                      else setVersao((n) => n + 1);
                    })
                  }
                >
                  Concordo com a visita em {a.quando}
                </Button>
                <button type="button" className="font-semibold text-forest underline underline-offset-2" onClick={onPreferirOutro} data-testid="conversa-outro-horario">
                  Prefiro outro horário
                </button>
              </div>
              <p className="mt-1 text-xs text-muted">{ETIQUETA_BRASILIA[0].toUpperCase() + ETIQUETA_BRASILIA.slice(1)}.</p>
            </>
          )}
          {erro && (
            <p role="alert" className="mt-2 text-red-700" data-testid="conversa-avaliacao-erro">
              {erro}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
