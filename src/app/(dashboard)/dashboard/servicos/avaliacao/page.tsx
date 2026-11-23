import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageTitle, Panel } from "@/components/dashboard/primitives";
import { portaDaAvaliacao } from "@/lib/vistoria/servico-avaliacao";
import { codigoDoImovel } from "@/lib/imovel-pagina";
import {
  ROTULO_ANUNCIAR,
  ROTULO_OUTROS_SERVICOS,
  SUBTITULO_DA_PORTA,
  TEXTO_ESCOLHER_IMOVEL,
  TEXTO_SEM_IMOVEL,
  TITULO_DA_PORTA,
  TITULO_ESCOLHER_IMOVEL,
  TITULO_SEM_IMOVEL,
  acaoDoImovelNaPorta,
  estadoDaPorta,
  linhaDoPedidoEmCurso,
  ordenarParaAPorta,
  textoAChegar,
  textoVariasEmCurso,
} from "@/lib/vistoria/porta-da-avaliacao";

export const metadata: Metadata = {
  title: "Avaliação do imóvel",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * E1104 (ORDEM-DUET-470): a porta da avaliação do imóvel, aonde o cartão da grade de Serviços leva o dono que ainda não
 * tem avaliação em curso. Três estados, nunca um beco:
 *  • a avaliação aberta para a conta e com imóvel → escolher o imóvel (cada um leva ao pedido, na página do nível);
 *  • aberta e sem imóvel → anunciar o imóvel primeiro;
 *  • fechada para a conta (fora do piloto) → o estado honesto: o serviço ainda não chegou à cidade. Aqui nada da
 *    avaliação é lido nem mostrado.
 * O morador não tem porta: volta aos Serviços. O "Voltar" é o da casca do painel (um só).
 * E1125 (ORDEM-DUET-539): com mais de uma avaliação em curso, o cartão traz a pessoa aqui em vez de escolher uma por
 * ela. A lista põe primeiro as avaliações em curso, da pedida mais recentemente para a mais antiga, diz quantas são e,
 * em cada imóvel, o código dele e de quando é o pedido.
 */
export default async function PortaDaAvaliacaoPage() {
  const porta = await portaDaAvaliacao();
  if (!porta) redirect("/dashboard/servicos");
  const estado = estadoDaPorta({ chaveAberta: porta.chaveAberta, imoveis: porta.imoveis.length });
  const aChegar = textoAChegar(porta.cidade);
  const imoveis = ordenarParaAPorta(porta.imoveis);
  const variasEmCurso = textoVariasEmCurso(imoveis.filter((i) => i.emCurso).length);
  return (
    <div data-testid="porta-avaliacao" data-estado={estado}>
      <PageTitle title={TITULO_DA_PORTA} subtitle={SUBTITULO_DA_PORTA} />
      {estado === "a_chegar" && (
        <Panel data-testid="porta-a-chegar">
          <EmptyState
            icon={ClipboardCheck}
            title={aChegar.titulo}
            text={aChegar.texto}
            action={
              <ButtonLink href="/dashboard/servicos" variant="secondary" size="sm" data-testid="porta-outros-servicos">
                {ROTULO_OUTROS_SERVICOS}
              </ButtonLink>
            }
          />
        </Panel>
      )}
      {estado === "sem_imovel" && (
        <Panel data-testid="porta-sem-imovel">
          <EmptyState
            icon={ClipboardCheck}
            title={TITULO_SEM_IMOVEL}
            text={TEXTO_SEM_IMOVEL}
            action={
              <ButtonLink href="/dashboard/imoveis/novo" variant="secondary" size="sm" data-testid="porta-anunciar">
                {ROTULO_ANUNCIAR}
              </ButtonLink>
            }
          />
        </Panel>
      )}
      {estado === "escolher" && (
        <Panel title={TITULO_ESCOLHER_IMOVEL} data-testid="porta-escolher">
          <p className="text-sm text-muted">{TEXTO_ESCOLHER_IMOVEL}</p>
          {variasEmCurso && (
            <p className="mt-3 text-sm font-semibold text-ink" data-testid="porta-varias-em-curso">
              {variasEmCurso}
            </p>
          )}
          <ul className="mt-4 grid gap-3" data-testid="porta-imoveis">
            {imoveis.map((i) => {
              const acao = acaoDoImovelNaPorta(i);
              const pedidoEm = linhaDoPedidoEmCurso(i.pedidoEm);
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-3" data-testid="porta-imovel" data-em-curso={i.emCurso ? "1" : "0"}>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{i.titulo}</span>
                    <span className="block text-xs text-muted" data-testid="porta-imovel-codigo">
                      {[codigoDoImovel(i.id), i.cidade].filter(Boolean).join(" · ")}
                    </span>
                    {pedidoEm && (
                      <span className="block text-xs text-muted" data-testid="porta-imovel-pedido-em">
                        {pedidoEm}
                      </span>
                    )}
                  </span>
                  <ButtonLink href={acao.href} variant="secondary" size="sm" data-testid="porta-imovel-acao">
                    {acao.rotulo}
                  </ButtonLink>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}
