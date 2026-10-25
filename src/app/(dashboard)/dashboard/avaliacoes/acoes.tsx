"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { pedirRevisaoAvaliacao, responderAvaliacao } from "@/lib/data/avaliacoes-resposta-actions";
import { LIMITE_RESPOSTA, MOTIVOS_REVISAO, type MotivoRevisao } from "@/lib/avaliacoes-resposta";

const CAMPO = "w-full rounded-lg border border-sage-200 px-3 py-2 text-base";

/** Botões "Responder" e "Pedir revisão" de uma avaliação recebida. A regra de verdade está no servidor e no banco. */
export function AcoesAvaliacao({
  avaliacaoId,
  podeResponder,
  podeRevisar,
}: {
  avaliacaoId: string;
  podeResponder: boolean;
  podeRevisar: boolean;
}) {
  const [aberto, setAberto] = useState<"resposta" | "revisao" | null>(null);
  const [texto, setTexto] = useState("");
  const [motivo, setMotivo] = useState<MotivoRevisao | "">("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, start] = useTransition();
  const router = useRouter();

  if (!podeResponder && !podeRevisar) return null;

  const enviar = () =>
    start(async () => {
      const r =
        aberto === "resposta"
          ? await responderAvaliacao(avaliacaoId, texto)
          : await pedirRevisaoAvaliacao(avaliacaoId, motivo, texto);
      if (!r.ok) return setErro(r.error ?? "Não foi possível enviar.");
      setErro(null);
      setAberto(null);
      setTexto("");
      router.refresh();
    });

  const abrir = (qual: "resposta" | "revisao") => {
    setAberto(qual);
    setErro(null);
    setTexto("");
  };

  return (
    <div className="mt-4">
      {aberto === null && (
        <div className="flex flex-wrap gap-2">
          {podeResponder && (
            <Button variant="secondary" type="button" data-testid="avaliacao-responder" onClick={() => abrir("resposta")}>
              Responder
            </Button>
          )}
          {podeRevisar && (
            <Button type="button" variant="outline" data-testid="avaliacao-pedir-revisao" onClick={() => abrir("revisao")}>
              Pedir revisão
            </Button>
          )}
        </div>
      )}
      {aberto !== null && (
        <div className="space-y-2">
          {aberto === "revisao" && (
            <>
              <label htmlFor={`motivo-${avaliacaoId}`} className="block text-sm font-medium text-ink">
                Motivo
              </label>
              <select
                id={`motivo-${avaliacaoId}`}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as MotivoRevisao | "")}
                className={CAMPO}
              >
                <option value="">Escolha o motivo</option>
                {(Object.keys(MOTIVOS_REVISAO) as MotivoRevisao[]).map((m) => (
                  <option key={m} value={m}>
                    {MOTIVOS_REVISAO[m]}
                  </option>
                ))}
              </select>
            </>
          )}
          <label htmlFor={`texto-${avaliacaoId}`} className="block text-sm font-medium text-ink">
            {aberto === "resposta" ? "Sua resposta (aparece junto da avaliação)" : "Explique o motivo"}
          </label>
          <textarea
            id={`texto-${avaliacaoId}`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={LIMITE_RESPOSTA}
            rows={3}
            className={CAMPO}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pendente} data-testid="avaliacao-enviar" onClick={enviar}>
              {aberto === "resposta" ? "Publicar resposta" : "Enviar pedido"}
            </Button>
            <Button type="button" variant="outline" disabled={pendente} onClick={() => setAberto(null)}>
              Cancelar
            </Button>
          </div>
          {erro && (
            <p role="alert" className="text-sm text-red-600">
              {erro}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
