"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { gerarResumoSemanalDeTeste } from "@/lib/data/resumo-semanal-qa-actions";

const ROTULO_RESULTADO: Record<string, string> = {
  enviado: "receberam",
  vazio: "sem novidade",
  desligado: "com o aviso desligado",
  teto: "no teto",
  silencio: "no silêncio",
  ocupado: "já em envio",
  falhou: "falharam",
};

/**
 * E375-B — "Gerar resumo semanal agora": o resumo da semana SÓ para as contas de teste (is_teste), gravado na caixa de
 * teste (aba E-mails). Confirmação na página, em dois passos (como a carteira de teste).
 */
export function GerarResumoSemanal() {
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  async function gerar() {
    setConfirmando(false);
    setOcupado(true);
    const r = await gerarResumoSemanalDeTeste().catch(() => ({ ok: false as const, error: "Não foi possível agora." }));
    if (r.ok) {
      const partes = Object.entries(r.totais.porResultado).map(([k, n]) => `${n} ${ROTULO_RESULTADO[k] ?? k}`);
      setMsg({ ok: true, texto: `${r.totais.enviados} de ${r.totais.pessoas} conta(s) de teste receberam o resumo${partes.length ? ` (${partes.join(", ")})` : ""}. Veja na aba E-mails.` });
    } else setMsg({ ok: false, texto: r.error });
    setOcupado(false);
  }

  return (
    <div className="space-y-3" data-testid="gerar-resumo-semanal">
      <p className="text-sm text-muted">
        Gera agora o resumo semanal de recomendações só para as contas de teste com pedido ativo ou busca salva com alerta. O e-mail vai para a caixa de teste. Fora do teste, o resumo sai às terças e só com a chave
        ligada.
      </p>
      {confirmando ? (
        <div className="flex flex-wrap gap-2" data-testid="gerar-resumo-confirmacao">
          <Button type="button" size="sm" onClick={gerar} disabled={ocupado}>
            Confirmar e gerar
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmando(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button type="button" size="sm" onClick={() => setConfirmando(true)} disabled={ocupado} data-testid="gerar-resumo-semanal-botao">
          {ocupado ? "Gerando…" : "Gerar resumo semanal agora"}
        </Button>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-forest" : "font-semibold text-red-700"}`} data-testid="gerar-resumo-resultado">
          {msg.texto}
        </p>
      )}
    </div>
  );
}
