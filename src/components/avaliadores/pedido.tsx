/*
  E1079, fatia 3 — o pedido do avaliador, como no mockup aprovado (avaliador-pedido): o título com a etiqueta, a foto do
  imóvel, o cartão com o local, o porte e o valor, e os botões "Aceitar pedido" e "Recusar".
  Só apresentação: a etapa, os textos e o que cada etapa mostra vêm de @/lib/vistoria/pedido-avaliador (ORDEM-DUET-445:
  E648 de pé, sem a linha da data, endereço completo só depois do aceite do dono); as cores e medidas, de
  @/lib/conta/visual-mockup.
*/
import { Banknote, CalendarClock, Home, MapPin } from "lucide-react";
import { IdentificacaoDoImovel } from "@/components/avaliadores/identificacao-do-imovel";
import { AceitarPedido } from "@/components/avaliadores/aceitar-pedido";
import { NotaDiasUteis } from "@/components/ui/nota-dias-uteis";
import { ButtonLink } from "@/components/ui/button";
import { ETIQUETA_DO_PEDIDO, tituloDoPedido, type EtapaDoPedido } from "@/lib/vistoria/pedido-avaliador";
import {
  CAIXA_VALOR_PEDIDO,
  CAPA_PEDIDO_AVALIADOR,
  CARTAO_PEDIDO_AVALIADOR,
  CARTAO_PEDIDO_SOBRE_A_CAPA,
  ETIQUETA_PEDIDO_AVALIADOR,
  ICONE_PEDIDO_AVALIADOR,
  LINHA_PEDIDO_AVALIADOR,
  SAUDACAO_PAINEL_AVALIADOR,
} from "@/lib/conta/visual-mockup";

export function PedidoDoAvaliador({
  pedidoId,
  etapa,
  capaUrl,
  local,
  porte,
  valor,
  prazoResposta,
  prazoAceite,
  prazoAceiteVencido,
  confirmacaoDoAceite,
  recusaDaData,
  prazoLaudo,
  imovel,
  ocupado,
  exemploValor,
  prazoMaxDias,
}: {
  pedidoId: string;
  etapa: EtapaDoPedido;
  /** E1108: de que imóvel é o pedido — "Título do anúncio · VN-XXXXXX". */
  imovel: string;
  /** E1108: o prazo combinado, depois do aceite ("Laudo em 2 dias"). */
  prazoLaudo?: string | null;
  capaUrl?: string;
  local: string;
  porte: string;
  valor: { texto: string; recebe: boolean };
  prazoResposta?: { texto: string; vencido: boolean } | null;
  /** E1101: até quando o dono pode aceitar a proposta (72 h depois dela). */
  prazoAceite?: string | null;
  /** E1142: o prazo do dono já passou — a tela deixa de dizer "falta o proprietário aceitar". */
  prazoAceiteVencido?: boolean;
  /** E1153: a confirmação do aceite do dono, enquanto a visita não tem data (a mesma frase que ele lê). */
  confirmacaoDoAceite?: string | null;
  /** E1173: o morador disse que não pode na data proposta (a mesma frase da lista), enquanto não há data nova. */
  recusaDaData?: string | null;
  ocupado: boolean;
  exemploValor: string;
  prazoMaxDias: number;
}) {
  return (
    <section data-testid="pedido-avaliador" data-etapa={etapa} className="mx-auto grid max-w-xl gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={SAUDACAO_PAINEL_AVALIADOR} data-testid="pedido-titulo">{tituloDoPedido(etapa)}</h1>
        <span className={etapa === "novo" ? ETIQUETA_PEDIDO_AVALIADOR.novo : ETIQUETA_PEDIDO_AVALIADOR.outras} data-testid="pedido-etiqueta">
          {ETIQUETA_DO_PEDIDO[etapa]}
        </span>
      </div>
      <IdentificacaoDoImovel texto={imovel} className="text-base" />
      <div>
        {/* A foto de capa do anúncio; sem ela, o cartão fica sozinho, sem buraco. */}
        {capaUrl ? (
          <div className={CAPA_PEDIDO_AVALIADOR} data-testid="pedido-capa">
            {/* eslint-disable-next-line @next/next/no-img-element -- capa pública do anúncio, tamanho da caixa */}
            <img src={capaUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div className={`${CARTAO_PEDIDO_AVALIADOR} ${capaUrl ? CARTAO_PEDIDO_SOBRE_A_CAPA : ""} grid gap-4`} data-testid="pedido-cartao">
          <p className={LINHA_PEDIDO_AVALIADOR} data-testid="pedido-local">
            <MapPin className={ICONE_PEDIDO_AVALIADOR} aria-hidden />
            <span>{local}</span>
          </p>
          <p className={LINHA_PEDIDO_AVALIADOR} data-testid="pedido-porte">
            <Home className={ICONE_PEDIDO_AVALIADOR} aria-hidden />
            <span>{porte}</span>
          </p>
          <p className={CAIXA_VALOR_PEDIDO} data-testid="pedido-valor-linha" data-recebe={valor.recebe ? "sim" : "nao"}>
            <Banknote className="h-7 w-7 shrink-0" aria-hidden />
            <span>{valor.texto}</span>
          </p>
          {prazoLaudo && (
            <p className={LINHA_PEDIDO_AVALIADOR} data-testid="pedido-prazo-laudo">
              <CalendarClock className={ICONE_PEDIDO_AVALIADOR} aria-hidden />
              <span>{prazoLaudo}</span>
            </p>
          )}
          <NotaDiasUteis de={[valor.texto, prazoLaudo]} />
        </div>
      </div>
      {ocupado && <p className="text-sm text-muted">Imóvel ocupado: a visita só acontece com a concordância do morador. Não fotografe pertences.</p>}
      {etapa === "novo" && (
        <>
          {prazoResposta && (
            <p className={`text-sm font-semibold ${prazoResposta.vencido ? "text-red-700" : "text-ink"}`} data-testid="pedido-prazo-resposta">
              {prazoResposta.texto}
            </p>
          )}
          <AceitarPedido pedidoId={pedidoId} exemploValor={exemploValor} prazoMaxDias={prazoMaxDias} />
        </>
      )}
      {etapa === "proposta_enviada" && (
        <p className="text-base text-ink" data-testid="pedido-aguarda-dono">
          {!prazoAceiteVencido && "Falta o proprietário aceitar a sua proposta. Quando ele aceitar, o endereço completo aparece aqui e você agenda a visita."}
          {prazoAceite && (
            <span className={prazoAceiteVencido ? "block text-sm font-semibold text-red-700" : "mt-2 block text-sm text-muted"} data-testid="pedido-prazo-aceite" data-vencido={prazoAceiteVencido ? "1" : undefined}>
              {prazoAceite}
            </span>
          )}
        </p>
      )}
      {etapa === "aceito" && confirmacaoDoAceite && (
        <p className="text-base font-semibold text-ink" data-testid="pedido-aceite-confirmado">
          {confirmacaoDoAceite}
        </p>
      )}
      {etapa === "aceito" && recusaDaData && (
        <p className="text-base font-semibold text-ink" data-testid="pedido-concordancia-recusada">
          {recusaDaData}
        </p>
      )}
      {etapa === "aceito" && (
        <ButtonLink href="/dashboard/parceiro/avaliacao#agenda" data-testid="pedido-agendar">
          Agendar a visita
        </ButtonLink>
      )}
      <ButtonLink href="/dashboard/parceiro/avaliacao#pedidos" variant="ghost" size="sm" data-testid="pedido-voltar-lista">
        Voltar às avaliações
      </ButtonLink>
    </section>
  );
}
