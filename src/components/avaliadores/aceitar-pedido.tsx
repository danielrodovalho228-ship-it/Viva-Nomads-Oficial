"use client";

/*
  E1079, fatia 3 — os botões do pedido do avaliador, como no mockup (avaliador-pedido): "Aceitar pedido" e "Recusar".
  ORDEM-DUET-445 (E648 de pé): "Aceitar pedido" ABRE, na mesma tela, o valor e o prazo do avaliador; quem aceita de fato
  é o envio da proposta (a mesma ação de hoje). "Recusar" segue pela ação de hoje.
*/
import { useState } from "react";
import { useRouter } from "next/navigation";
import { NotaDiasUteis } from "@/components/ui/nota-dias-uteis";
import { FormAcao } from "@/components/vistoria/form-acao";
import { semQuedaDeRede } from "@/lib/erro-de-rede";
import { proporPrecoEPrazo, responderDesignacao } from "@/lib/vistoria/actions";
import { ROTULO_ACEITAR_PEDIDO, ROTULO_ENVIAR_PROPOSTA, ROTULO_RECUSAR_PEDIDO } from "@/lib/vistoria/pedido-avaliador";
import { BOTAO_ACEITAR_PEDIDO, BOTAO_RECUSAR_PEDIDO } from "@/lib/conta/visual-mockup";

const campo = "mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base";

export function AceitarPedido({ pedidoId, exemploValor, prazoMaxDias }: { pedidoId: string; exemploValor: string; prazoMaxDias: number }) {
  const [aberto, setAberto] = useState(false);
  const router = useRouter();
  // As ações são as de hoje (embrulhadas: sem conexão, a tela diz o erro em vez de cair). Depois de enviada a proposta, a tela relê o pedido (passa a "Proposta enviada"); depois de
  // recusar, o pedido deixa de ser deste avaliador e a tela volta à lista.
  const propor = async (form: FormData) => {
    const r = await semQuedaDeRede(proporPrecoEPrazo(form));
    if (r.ok) router.refresh();
    return r;
  };
  const recusar = async (form: FormData) => {
    const r = await semQuedaDeRede(responderDesignacao(form));
    if (r.ok) router.push("/dashboard/parceiro/avaliacao#pedidos");
    return r;
  };
  return (
    <div data-testid="pedido-acoes">
      {aberto ? (
        <FormAcao acao={propor} className="grid gap-3" testid="pedido-proposta">
          <input type="hidden" name="pedidoId" value={pedidoId} />
          <p className="text-base text-ink">Para aceitar, diga o seu valor e em quantos dias entrega o laudo. O proprietário vê a sua proposta e decide.</p>
          <label className="text-sm">
            Seu valor (R$)
            <input name="valor" inputMode="decimal" required placeholder={`ex.: ${exemploValor}`} className={campo} data-testid="pedido-valor" />
          </label>
          <label className="text-sm">
            Prazo do laudo (dias úteis depois da visita, até {prazoMaxDias})
            <input name="prazoDias" type="number" min={1} max={prazoMaxDias} step={1} required className={campo} data-testid="pedido-prazo" />
          </label>
          <NotaDiasUteis className="text-sm text-muted" />
          <div className="grid grid-cols-2 gap-3">
            <button type="submit" className={BOTAO_ACEITAR_PEDIDO} data-testid="pedido-enviar-proposta">
              {ROTULO_ENVIAR_PROPOSTA}
            </button>
            <button type="button" className={BOTAO_RECUSAR_PEDIDO} onClick={() => setAberto(false)} data-testid="pedido-voltar">
              Voltar
            </button>
          </div>
        </FormAcao>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className={BOTAO_ACEITAR_PEDIDO} onClick={() => setAberto(true)} data-testid="pedido-aceitar">
            {ROTULO_ACEITAR_PEDIDO}
          </button>
          <FormAcao acao={recusar}>
            <input type="hidden" name="pedidoId" value={pedidoId} />
            <input type="hidden" name="resposta" value="recusar" />
            <button type="submit" className={BOTAO_RECUSAR_PEDIDO} data-testid="pedido-recusar">
              {ROTULO_RECUSAR_PEDIDO}
            </button>
          </FormAcao>
        </div>
      )}
    </div>
  );
}
