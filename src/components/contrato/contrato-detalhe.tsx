import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { getContratoParaAssinar } from "@/lib/data/contrato-assinar-actions";
import { conferenciasDoContrato } from "@/lib/data/conferencia-actions";
import { tipoAcessoDoContrato } from "@/lib/data/contrato-acesso";
import { DICAS_CONFERENCIA_CAMERAS, ITEM_CONFERENCIA_CAMERAS, LEMBRETE_SENHA_ENTRADA, mostrarChecklistCameras, mostrarLembreteSenha } from "@/lib/anuncio/privacidade";
import { instrucoesDoContrato } from "@/lib/data/checkin-actions";
import { podeEditarInstrucoes, podeNaoConsegui } from "@/lib/checkin";
import { dataBR } from "@/lib/utils";
import { tomDoSelo } from "@/lib/contrato-estado";
import { AssinarContrato } from "./assinar-contrato";
import { AvisoAssinatura } from "./aviso-assinatura";
import { CheckinContrato } from "./checkin-contrato";
import { LinhaDoTempoEstadia } from "./linha-do-tempo-estadia";
import { ConferenciaContrato } from "./conferencia-contrato";
import { meuCartaoPostal } from "@/lib/data/cartoes-actions";
import { CartaoCompartilhar } from "@/components/cartoes/cartao-compartilhar";
import { AcoesEstadia } from "@/components/estadia/acoes-estadia";
import { acoesDaEstadia } from "@/lib/estadia/acoes-estadia";

/**
 * Detalhe do contrato para as DUAS partes (ordens 0fd301f0 e f375fdc1): o inquilino chega por
 * /dashboard/locacoes/[id] e o proprietário por /dashboard/contratos/[id]. A leitura passa pelo RLS;
 * quem não é parte (ou id inexistente) recebe 404.
 */
export async function ContratoDetalhe({
  id,
  voltarHref,
  voltarRotulo,
}: {
  id: string;
  voltarHref: string;
  voltarRotulo: string;
}) {
  const c = await getContratoParaAssinar(id);
  if (!c) notFound();
  // Conferência de entrada e de saída: só com contrato em andamento ou encerrado e assinado pelas duas partes.
  const mostraConferencia = ["ativo", "concluido", "encerrado_sem_renovacao"].includes(c.status) && !!c.assinadoProprietarioEm && !!c.assinadoInquilinoEm;
  const conferencia = mostraConferencia ? await conferenciasDoContrato(c.id) : null;
  const lembreteSenha =
    c.papel === "inquilino" && c.status === "ativo" && mostraConferencia
      ? mostrarLembreteSenha({
          papel: c.papel,
          tipoAcesso: await tipoAcessoDoContrato(c.id),
          status: c.status,
          assinadoPelasDuasPartes: !!c.assinadoProprietarioEm && !!c.assinadoInquilinoEm,
        })
      : false;
  // Check-in garantido: instruções de entrada (dono preenche; inquilino vê após as duas assinaturas) e "Não consegui entrar".
  const dadosCheckin = { status: c.status, papel: c.papel, assinadoProprietarioEm: c.assinadoProprietarioEm, assinadoInquilinoEm: c.assinadoInquilinoEm };
  const checkin = c.status === "ativo" ? await instrucoesDoContrato(c.id) : null;
  // Cartão-postal pós-estadia (cartões compartilháveis, T1): só para o morador, depois da saída.
  const postal = c.papel === "inquilino" ? await meuCartaoPostal(c.id) : null;
  return (
    <>
      <Link href={voltarHref} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {voltarRotulo}
      </Link>
      <PageTitle title={c.imovel} />
      <p className="-mt-2 mb-4">
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${tomDoSelo(c.estado)}`} data-testid="contrato-selo" data-chave={c.estado.chave}>
          {c.estado.selo}
        </span>
      </p>
      {postal?.ok && (
        <Panel className="mb-5 p-5" data-testid="cartao-postal-painel">
          <h2 className="font-title text-base font-semibold text-ink">Seu cartão-postal da estadia</h2>
          <p className="mt-1 text-sm text-muted">Uma lembrança para compartilhar no WhatsApp, com um QR para o imóvel. Mostra a cidade e o mês/ano; seu nome só se você quiser.</p>
          <div className="mt-4">
            <CartaoCompartilhar inicial={postal.valor} />
          </div>
        </Panel>
      )}
      <Panel id="contrato" className="scroll-mt-24 p-5">
        <h2 className="font-title text-base font-semibold text-ink">Contrato</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink" data-testid="contrato-resumo">
          {c.resumo.map((linha) => (
            // O número do contrato (UUID) e a data não têm espaço: sem isto estouram a tela a 360 px.
            <li key={linha} className="[overflow-wrap:anywhere]">
              {linha}
            </li>
          ))}
        </ul>
        {c.inicioEstadia && (
          <p className="mt-3 text-sm font-medium text-ink" data-testid="contrato-inicio-estadia">
            Início da estadia: {dataBR(c.inicioEstadia)}
          </p>
        )}
        <AvisoAssinatura contratoId={c.id} aviso={c.aviso} />
        {!c.euAssinei && c.status === "ativo" && <AssinarContrato contratoId={c.id} />}
      </Panel>
      {lembreteSenha && (
        <Panel className="mt-5 p-5" data-testid="lembrete-senha-entrada">
          <h2 className="font-title text-base font-semibold text-ink">Antes de entrar</h2>
          <p className="mt-1 text-sm text-ink">{LEMBRETE_SENHA_ENTRADA}</p>
        </Panel>
      )}
      {checkin && (
        <Panel id="checkin-painel" className="mt-5 scroll-mt-24 p-5" data-testid="checkin-painel">
          <h2 className="font-title text-base font-semibold text-ink">Check-in: instruções de entrada</h2>
          <div className="mt-3">
            <CheckinContrato contratoId={c.id} info={checkin} podeEditar={podeEditarInstrucoes(dadosCheckin)} podeNaoConsegui={podeNaoConsegui(dadosCheckin)} />
          </div>
        </Panel>
      )}
      <LinhaDoTempoEstadia etapas={c.linhaDoTempo} />
      {(c.assinadoProprietarioEm || c.assinadoInquilinoEm) && (
        <Panel className="mt-5 p-5">
          <h2 className="font-title text-base font-semibold text-ink">Pacote de provas</h2>
          <p className="mt-1 text-sm text-muted">
            Um PDF com o resumo do contrato, o código de cada assinatura, os pagamentos marcados e as respostas da conferência, em ordem de data.
          </p>
          <a
            href={`/api/contrato/${c.id}/provas`}
            data-testid="baixar-provas"
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-sage-300 bg-white px-4 text-sm font-medium text-forest hover:bg-sage-50 sm:w-auto"
          >
            Baixar pacote de provas (PDF)
          </a>
        </Panel>
      )}
      {conferencia && (
        <Panel className="mt-5 p-5">
          <h2 className="font-title text-base font-semibold text-ink">Conferência de entrada e saída</h2>
          <p className="mt-1 text-sm text-muted">Fotos e itens por cômodo, confirmados ou contestados pelas duas partes. É a base para conversar sobre a Caução.</p>
          {mostrarChecklistCameras({ papel: c.papel, status: c.status }) && (
            <div className="mt-4 rounded-lg bg-sage-50 p-3 text-sm text-ink" data-testid="checklist-cameras">
              <p className="font-medium">☐ {ITEM_CONFERENCIA_CAMERAS}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                {DICAS_CONFERENCIA_CAMERAS.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4">
            <ConferenciaContrato contratoId={c.id} statusContrato={c.status} dados={conferencia} />
          </div>
        </Panel>
      )}
      {/* Prompt 41: o "cogumelo" (Ações desta estadia) — só aqui, no contexto da estadia, para as duas partes. */}
      <AcoesEstadia acoes={acoesDaEstadia({ papel: c.papel, status: c.status, temInstrucoes: !!checkin })} />
    </>
  );
}
