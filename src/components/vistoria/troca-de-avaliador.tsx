"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAcao } from "@/components/vistoria/form-acao";
import {
  CAMPO_CONFIRMAR_TROCA,
  CHAVE_TROCA_FEITA,
  ROTULO_CONFIRMAR_TROCA,
  ROTULO_ESCOLHER_OUTRO,
  ROTULO_MANTER_PROPOSTA,
  mensagemDepoisDaTroca,
  type TextoDaTroca,
} from "@/lib/vistoria/troca-de-avaliador";

type Res = { ok: true; mensagem?: string } | { ok: false; erro: string };

function marcar(pedidoId: string | null) {
  try {
    if (pedidoId) sessionStorage.setItem(CHAVE_TROCA_FEITA, pedidoId);
    else sessionStorage.removeItem(CHAVE_TROCA_FEITA);
  } catch {
    // Sem armazenamento (modo privado): a troca vale do mesmo jeito; só não há o aviso na tela seguinte.
  }
}

/**
 * E1100: "Escolher outro avaliador" com a proposta viva. O primeiro clique NÃO descarta nada: abre a confirmação, que
 * escreve o que se perde (o avaliador, a proposta, "não dá para desfazer") e se há outro avaliador para escolher. Só o
 * botão da confirmação envia, com o campo que o servidor exige. "Manter esta proposta" fecha e nada muda.
 */
export function TrocaDeAvaliador({ pedidoId, texto, acao }: { pedidoId: string; texto: TextoDaTroca; acao: (form: FormData) => Promise<Res> }) {
  const [aberta, setAberta] = useState(false);
  const titulo = useRef<HTMLParagraphElement>(null);
  const caixaDoGatilho = useRef<HTMLSpanElement>(null);
  const voltarAoGatilho = useRef(false);

  useEffect(() => {
    if (aberta) titulo.current?.focus();
    else if (voltarAoGatilho.current) caixaDoGatilho.current?.querySelector("button")?.focus();
  }, [aberta]);

  // A marca vai ANTES do envio: quando a ação dá certo, este bloco sai da tela e é a escolha que a lê. Se a ação falhar, sai.
  const enviar = useCallback(
    async (form: FormData): Promise<Res> => {
      marcar(pedidoId);
      const r = await acao(form);
      if (!r.ok) marcar(null);
      return r;
    },
    [acao, pedidoId],
  );

  if (!aberta) {
    return (
      <span ref={caixaDoGatilho} className="inline-flex">
        <Button type="button" variant="secondary" size="sm" aria-expanded={false} data-testid="trocar-avaliador" onClick={() => setAberta(true)}>
          {ROTULO_ESCOLHER_OUTRO}
        </Button>
      </span>
    );
  }
  return (
    <div className="w-full rounded-lg border border-line bg-white p-3" role="group" aria-labelledby={`troca-titulo-${pedidoId}`} data-testid="troca-confirmacao">
      <p id={`troca-titulo-${pedidoId}`} ref={titulo} tabIndex={-1} className="font-semibold text-ink outline-none" data-testid="troca-titulo">
        {texto.titulo}
      </p>
      <ul className="mt-2 grid list-disc gap-1 pl-4 text-ink" data-testid="troca-perde">
        {texto.perde.map((linha) => (
          <li key={linha}>{linha}</li>
        ))}
      </ul>
      <p className={`mt-2 ${texto.semOutro ? "font-semibold text-red-700" : "text-muted"}`} data-testid="troca-depois" data-sem-outro={texto.semOutro ? "1" : "0"}>
        {texto.depois}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <FormAcao acao={enviar} testid="recusar-proposta">
          <input type="hidden" name="pedidoId" value={pedidoId} />
          <input type="hidden" name={CAMPO_CONFIRMAR_TROCA} value="1" />
          <Button type="submit" variant="secondary" size="sm">
            {ROTULO_CONFIRMAR_TROCA}
          </Button>
        </FormAcao>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            voltarAoGatilho.current = true;
            setAberta(false);
          }}
        >
          {ROTULO_MANTER_PROPOSTA}
        </Button>
      </div>
    </div>
  );
}

/**
 * E1100: logo depois da troca, o pedido voltou à escolha. Este aviso diz o que aconteceu e leva o dono até lá (rola a
 * tela e põe o foco), em vez de deixar a página parada onde estava a proposta. Só aparece para quem acabou de confirmar
 * a troca deste pedido, neste navegador; numa visita comum à página não aparece nada.
 */
export function DepoisDaTroca({ pedidoId, aguardando }: { pedidoId: string; aguardando: boolean }) {
  const [mostrar, setMostrar] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let feita = false;
    try {
      feita = sessionStorage.getItem(CHAVE_TROCA_FEITA) === pedidoId;
      if (feita) sessionStorage.removeItem(CHAVE_TROCA_FEITA);
    } catch {
      feita = false;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (feita) setMostrar(true);
  }, [pedidoId]);

  useEffect(() => {
    if (!mostrar) return;
    ref.current?.scrollIntoView({ block: "start" });
    ref.current?.focus({ preventScroll: true });
  }, [mostrar]);

  if (!mostrar) return null;
  return (
    <p ref={ref} tabIndex={-1} role="status" className="scroll-mt-24 rounded-lg border border-line bg-white p-3 font-semibold text-ink outline-none" data-testid="troca-feita">
      {mensagemDepoisDaTroca(aguardando)}
    </p>
  );
}
