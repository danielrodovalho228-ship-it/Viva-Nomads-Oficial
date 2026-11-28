"use client";
/*
  E1248 PR 1 (ESPEC-E1248 v11, 2.4) — o botão da equipe no chamado da contestação da devolução da caução: um componente
  irmão do da anulação (E1229). Usa decidirDevolucaoPelaCentral, que recusa a segunda decisão, o chamado de outro
  contrato e a decisão com o prazo do anexo a correr sem comprovante.
*/
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { semQuedaDeRede } from "@/lib/erro-de-rede";
import { decidirDevolucaoPelaCentral } from "@/lib/data/devolucao-caucao-actions";
import { MOTIVO_MAXIMO } from "@/lib/caucao/devolucao-maquina";

export type DevolucaoNoChamado = {
  /** O link assinado do comprovante, para a equipe; null sem comprovante. */
  comprovanteUrl: string | null;
  /** A decisão já tomada ("confirmada" ou "nao_confirmada"); null enquanto a disputa está aberta. */
  decisao: string | null;
  /** O texto do prazo do anexo ("até 08/12 15:30"), enquanto o comprovante não chegou e o prazo corre. */
  esperaAnexo: string | null;
};

export function DecidirDevolucaoCentral({ chamadoId, devolucao }: { chamadoId: string; devolucao: DevolucaoNoChamado | null }) {
  const router = useRouter();
  const enviando = useRef(false);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(devolucao?.decisao ?? null);

  async function decidir(decisao: "confirmada" | "nao_confirmada") {
    if (enviando.current) return;
    enviando.current = true;
    setSaving(true);
    setErro(null);
    const r = await semQuedaDeRede(decidirDevolucaoPelaCentral({ chamadoId, decisao, motivo }));
    setSaving(false);
    enviando.current = false;
    if (!r.ok) return setErro(r.error);
    setFeito(decisao);
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-white p-3" data-testid="central-devolucao">
      <p className="text-sm font-semibold text-ink">Contestação da devolução da caução</p>
      {/* PROPOSTA DE TEXTO */}
      <p className="mt-1 text-xs text-muted">Decida só se o valor foi recebido. O comprovante do proprietário é a prova.</p>
      {devolucao?.comprovanteUrl ? (
        <a href={devolucao.comprovanteUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-forest underline" data-testid="central-devolucao-comprovante">
          Ver o comprovante
        </a>
      ) : (
        <p className="mt-1 text-xs text-amber-800" data-testid="central-devolucao-sem-comprovante">
          {devolucao?.esperaAnexo ? `Sem comprovante: o proprietário tem ${devolucao.esperaAnexo} para anexar.` : "Sem comprovante."}
        </p>
      )}
      {feito ? (
        <p className="mt-2 text-xs text-forest" role="status" data-testid="central-devolucao-decidida">
          {/* PROPOSTA DE TEXTO */}
          {feito === "confirmada" ? "Devolução confirmada. As duas partes foram avisadas." : "Devolução não confirmada. As duas partes foram avisadas."}
        </p>
      ) : (
        <>
          <label className="mt-2 block text-xs text-muted">
            Motivo (obrigatório para não confirmar; vai para as duas partes)
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={MOTIVO_MAXIMO} rows={2} className="mt-1 w-full rounded-lg border border-sage-200 bg-white px-2 py-1 text-sm text-ink" data-testid="central-devolucao-motivo" />
          </label>
          {erro && <p className="mt-1 text-xs text-red-700" data-testid="central-devolucao-erro">{erro}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => decidir("confirmada")} disabled={saving} className="rounded-lg border border-forest bg-white px-3 py-1 text-xs font-semibold text-forest" data-testid="central-devolucao-confirmar">
              Confirmar a devolução
            </button>
            <button type="button" onClick={() => decidir("nao_confirmada")} disabled={saving} className="rounded-lg border border-red-700 bg-white px-3 py-1 text-xs font-semibold text-red-700" data-testid="central-devolucao-nao-confirmar">
              Não confirmar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
