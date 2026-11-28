"use client";

import { CampoData } from "@/components/ui/campo-data";
import { AnularRegistro } from "@/components/anulacao/anular-registro";
import { CampoReais } from "@/components/ui/campo-reais";
import { SeletorArquivo } from "@/components/ui/seletor-arquivo";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { dataBR } from "@/lib/fiscal/documento";
import { textoLinhaRecibo } from "@/lib/documentos-linha";
import type { AcertoView, DocumentoView, ReciboView } from "@/lib/data/documentos-actions";
import { registrarDevolucaoCaucao, responderDevolucaoCaucao } from "@/lib/data/documentos-actions";
import { anexarComprovanteDaDevolucao } from "@/lib/data/devolucao-caucao-actions";
import { documentoDoMeio, horaAnunciada, linhaDoDonoNaDisputa, rotuloDoAcerto, MOTIVO_MAXIMO } from "@/lib/caucao/devolucao-maquina";
import { confirmarPagamento, type PagamentoView } from "@/lib/data/contratos-actions";
import { statusHumano } from "@/lib/status-humano";
import { textoComponentes } from "@/lib/pagamento-componentes";
import { textoDoSeloAnulado, type AnuladoAntesDaConfirmacao } from "@/lib/anulados-antes-da-confirmacao";

/**
 * Documentos do contrato e devolução da caução — mesmas peças em "Contratos &
 * blocos" (proprietário) e "Minhas locações" (inquilino). Nada aqui movimenta
 * dinheiro: a plataforma registra, a outra parte confirma, e o PDF sai.
 */

const input = "mt-1 w-full rounded-lg border border-sage-200 bg-white px-2 py-2 text-sm text-ink outline-none focus:border-sage";

/** Estados vazios: a leitura dos documentos e da caução falhou — nunca dizer "nenhum documento" nem caução 0. */
export const MSG_DOCUMENTOS_NAO_CARREGARAM = "Não foi possível carregar os documentos e a caução deste contrato agora. Recarregue a página para tentar de novo.";

export function AvisoDocumentosFalhou() {
  return (
    <p role="alert" className="mt-4 border-t border-sage-200 pt-3 text-sm text-amber-900" data-testid="documentos-falhou">
      {MSG_DOCUMENTOS_NAO_CARREGARAM}
    </p>
  );
}

export function ListaDocumentos({ documentos, recibos = [], anular = false }: { documentos: DocumentoView[]; recibos?: ReciboView[]; /** E1229: o dono pede a anulação de um registro já confirmado. */ anular?: boolean }) {
  if (documentos.length === 0 && recibos.length === 0) return null;
  return (
    <div className="mt-4 border-t border-sage-200 pt-3" data-testid="documentos-contrato">
      <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase text-muted">
        <FileText className="h-3.5 w-3.5" /> Documentos
      </p>
      {recibos.length > 0 && (
        <ul className="mb-2 space-y-2" data-testid="recibos-pagamentos">
          {recibos.map((r) => (
            <li key={r.pagamentoId} className="flex flex-wrap items-center justify-between gap-2 text-sm" data-testid="recibo-pagamento" data-emitido={r.documentoId ? "sim" : "nao"}>
              <span className="min-w-0 text-ink">
                {/* E1067 + E1233 (ORDENS-DUET 1194 e 1208): número · bloco · TOTAL · período; o texto do documento fica no PDF. */}
                {textoLinhaRecibo(r)}
                {r.anulada && <SeloAnulado motivo={r.motivoAnulacao} />}
              </span>
              {/* E1243: o pedido aberto à Central fica à vista (e não se pede outra vez) até o chamado ser resolvido. PROPOSTA DE TEXTO. */}
              {anular && r.pedidoAnulacao && !r.anulada && (
                <span className="text-xs text-muted" data-testid="pedido-anulacao">
                  Anulação pedida à Central: chamado {r.pedidoAnulacao}, em análise.
                </span>
              )}
              {anular && !r.anulada && !r.pedidoAnulacao && <AnularRegistro pagamentoId={r.pagamentoId} confirmado />}
              {r.documentoId ? (
                <a href={`/api/documentos/${r.documentoId}`} className="inline-flex items-center gap-1 text-xs font-medium text-forest underline" data-testid="baixar-recibo">
                  <Download className="h-3.5 w-3.5" /> Baixar recibo (PDF)
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-2">
        {documentos.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="min-w-0 text-ink">
              {d.rotulo} <span className="text-muted">· {d.numero} · {formatBRL(d.valor)}</span>
              {d.anulada && <SeloAnulado motivo={d.motivoAnulacao} />}
              {d.periodoInicio && (
                <span className="block text-xs text-muted">
                  {dataBR(d.periodoInicio)} a {dataBR(d.periodoFim)}
                </span>
              )}
            </span>
            <a href={`/api/documentos/${d.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-forest underline">
              <Download className="h-3.5 w-3.5" /> Baixar PDF
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "Anulado: registro em duplicidade" — o documento existiu, o PDF continua acessível, mas não vale mais. E1250: aparece
 * pela DECISÃO (a data); sem motivo, só "Anulado". O texto é o da função única (textoDoSeloAnulado).
 */
function SeloAnulado({ motivo }: { motivo: string | null }) {
  return (
    <span className="ml-2 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700" data-testid="selo-anulado">
      {textoDoSeloAnulado(motivo)}
    </span>
  );
}

/** E1248 (ORDEM-1326): o rótulo do estado sai da regra pura — com a disputa aberta, sem o sufixo. */
const rotulo = (a: AcertoView) => rotuloDoAcerto({ status: a.status, disputaAberta: a.disputaAberta, via: a.confirmacaoVia });

/** E1248 (2.7): o dono anexa o comprovante da devolução (opcional no registro, pedido na disputa). */
function AnexarComprovante({ acerto }: { acerto: AcertoView }) {
  const router = useRouter();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const doc = documentoDoMeio(acerto.meio);
  return (
    <div className="mt-2 rounded-lg border border-sage-200 bg-white p-2" data-testid="devolucao-anexar">
      {acerto.comprovantePedidoAte ? (
        <p className="text-xs text-amber-800">
          {/* PROPOSTA DE TEXTO */}
          A equipe precisa do {doc}. Anexe até {horaAnunciada(new Date(acerto.comprovantePedidoAte))}.
        </p>
      ) : (
        <p className="text-xs text-muted">
          {/* PROPOSTA DE TEXTO */}
          Se quiser, anexe o {doc} (PDF ou foto). Só você, o morador e a equipe da Viva o veem.
        </p>
      )}
      <SeletorArquivo className="mt-2" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} testid="devolucao-anexar-arquivo" />
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
      <Button
        size="sm"
        variant="outline"
        className="mt-2"
        disabled={!arquivo || enviando}
        onClick={async () => {
          if (!arquivo) return;
          setEnviando(true);
          setErro(null);
          const fd = new FormData();
          fd.set("acertoId", acerto.id);
          fd.set("arquivo", arquivo);
          const r = await anexarComprovanteDaDevolucao(fd).catch(() => ({ ok: false as const, error: "Falha de conexão." }));
          setEnviando(false);
          if (!r.ok) return setErro(r.error);
          router.refresh();
        }}
      >
        {enviando ? "Anexando…" : "Anexar o comprovante"}
      </Button>
    </div>
  );
}

/** O link do comprovante já anexado (para quem o pode ler). */
function LinkDoComprovante({ acerto }: { acerto: AcertoView }) {
  if (!acerto.temComprovante) return null;
  return acerto.comprovanteUrl ? (
    <a href={acerto.comprovanteUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-medium text-forest underline" data-testid="devolucao-comprovante">
      Ver o comprovante
    </a>
  ) : (
    <p className="mt-1 text-xs text-muted" data-testid="devolucao-comprovante">Comprovante anexado.</p>
  );
}

/** Proprietário: registra quanto devolveu da caução (depois do fim da locação). */
export function DevolucaoCaucaoDono({
  contratoId,
  encerrado,
  caucaoConfirmada,
  acerto,
  hojeISO,
}: {
  contratoId: string;
  encerrado: boolean;
  caucaoConfirmada: number;
  acerto: AcertoView | null;
  hojeISO: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(String(caucaoConfirmada));
  const [data, setData] = useState(hojeISO);
  const [meio, setMeio] = useState("pix");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // E1248 (decisão 6; 2-A): com a disputa aberta, o dono lê só "contestada pelo morador" e a linha nova; anexa o
  // comprovante; não registra outra devolução até a decisão da Central.
  if (acerto && (acerto.status !== "desconto_contestado" || acerto.disputaAberta)) {
    const aberta = acerto.status === "aguardando_confirmacao" || acerto.disputaAberta;
    return (
      <div className="mt-3" data-testid="devolucao-caucao">
        <p className="text-xs text-muted">
          Caução: devolvidos {formatBRL(acerto.valorDevolvido)} de {formatBRL(acerto.caucaoTotal)} em {dataBR(acerto.dataDevolucao)} — {rotulo(acerto) || statusHumano(acerto.status)}.
        </p>
        {acerto.disputaAberta && <p className="mt-1 text-xs text-amber-800" data-testid="devolucao-disputa">{linhaDoDonoNaDisputa()}</p>}
        <LinkDoComprovante acerto={acerto} />
        {aberta && !acerto.temComprovante && <AnexarComprovante acerto={acerto} />}
      </div>
    );
  }
  if (!encerrado || caucaoConfirmada <= 0) return null;
  if (!aberto) {
    return (
      <div className="mt-3" data-testid="devolucao-caucao">
        {acerto?.status === "desconto_contestado" && <p className="mb-2 text-xs text-amber-800">Devolução anterior: {rotulo(acerto)}.</p>}
        <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
          Registrar devolução da caução
        </Button>
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-xl border border-sage-200 bg-white p-3" data-testid="devolucao-caucao">
      <p className="mb-2 flex items-center gap-2 text-xs font-medium text-ink">
        <ShieldCheck className="h-3.5 w-3.5 text-sage" /> Devolução da caução — você devolve direto ao morador; a plataforma só registra
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-muted">
          Valor devolvido (caução: {formatBRL(caucaoConfirmada)})
          <CampoReais semPrefixo centavos value={valor === "" ? null : Number(valor)} onChange={(v) => setValor(v == null ? "" : String(v))} className={input} />
        </label>
        <label className="text-xs text-muted">
          Data
          <CampoData value={data} onChange={(e) => setData(e.target.value)} className={input} />
        </label>
        <label className="text-xs text-muted">
          Como
          <select value={meio} onChange={(e) => setMeio(e.target.value)} className={input}>
            <option value="pix">Pix</option>
            <option value="transferencia">Transferência</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="outro">Outro</option>
          </select>
        </label>
      </div>
      {Number(valor) < caucaoConfirmada && <p className="mt-2 text-[11px] text-amber-800">Com desconto, explique os motivos ao morador (com fotos da conferência) pela conversa antes de registrar.</p>}
      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" disabled={salvando} onClick={() => setAberto(false)}>
          Cancelar
        </Button>
        <Button
          variant="gold"
          size="sm"
          disabled={salvando}
          onClick={async () => {
            setSalvando(true);
            setErro(null);
            const r = await registrarDevolucaoCaucao({ contratoId, valorDevolvido: Number(valor), dataDevolucao: data, meio }).catch(() => ({ ok: false as const, error: "Falha de conexão." }));
            setSalvando(false);
            if (!r.ok) return setErro(r.error);
            setAberto(false);
            router.refresh();
          }}
        >
          {salvando ? "Registrando…" : "Registrar devolução"}
        </Button>
      </div>
    </div>
  );
}

/** Inquilino: confirma (ou contesta) a devolução registrada pelo proprietário. */
export function DevolucaoCaucaoInquilino({ acerto }: { acerto: AcertoView | null }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [contestando, setContestando] = useState(false);
  const [motivo, setMotivo] = useState("");
  if (!acerto) return null;
  if (acerto.status !== "aguardando_confirmacao") {
    return (
      <div className="mt-3" data-testid="devolucao-caucao">
        <p className="text-xs text-muted">
          Caução: {formatBRL(acerto.valorDevolvido)} de {formatBRL(acerto.caucaoTotal)} — {rotulo(acerto) || statusHumano(acerto.status)}.
        </p>
        <LinkDoComprovante acerto={acerto} />
      </div>
    );
  }
  const responder = async (r: "confirmar" | "contestar") => {
    setOcupado(true);
    setErro(null);
    const res = await responderDevolucaoCaucao(acerto.id, r, motivo).catch(() => ({ ok: false as const, error: "Falha de conexão." }));
    setOcupado(false);
    if (!res.ok) return setErro(res.error);
    router.refresh();
  };
  return (
    <div className="mt-3 rounded-xl border border-champagne bg-champagne/10 p-3 text-sm" data-testid="devolucao-caucao">
      <p className="text-ink">
        O proprietário registrou a devolução de <strong>{formatBRL(acerto.valorDevolvido)}</strong> da caução de {formatBRL(acerto.caucaoTotal)}, em {dataBR(acerto.dataDevolucao)}. Você recebeu?
      </p>
      {acerto.prazoRespostaAte && (
        <p className="mt-1 text-xs text-muted" data-testid="devolucao-prazo">
          {/* PROPOSTA DE TEXTO (E1248): a hora sai do mesmo relógio do aviso e da rotina (M13). */}
          Responda até {horaAnunciada(new Date(acerto.prazoRespostaAte))}. Sem resposta, a devolução vale como confirmada.
        </p>
      )}
      <LinkDoComprovante acerto={acerto} />
      {contestando && (
        <label className="mt-2 block text-xs text-muted">
          {/* PROPOSTA DE TEXTO (E1248, decisão 12): o campo do motivo. */}
          O que aconteceu? (pelo menos 5 letras; vai para a equipe da Viva)
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={MOTIVO_MAXIMO} rows={2} className={input} data-testid="devolucao-motivo" />
        </label>
      )}
      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {!contestando && (
          <Button size="sm" variant="secondary" disabled={ocupado} onClick={() => responder("confirmar")}>
            <Check className="h-4 w-4" /> Sim, recebi
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={ocupado} onClick={() => (contestando ? responder("contestar") : setContestando(true))}>
          {contestando ? "Enviar a contestação" : "Não recebi / discordo"}
        </Button>
        {contestando && (
          <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => setContestando(false)}>
            Cancelar
          </Button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted">Confirmando, sai o termo de devolução em PDF para os dois.</p>
    </div>
  );
}

const FORMA: Record<string, string> = { pix: "Pix", boleto: "boleto", transferencia: "transferência", dinheiro: "dinheiro", outro: "outra forma" };

/** Inquilino: confirma os pagamentos que o proprietário registrou → recibo/comprovante. */
export function ConfirmarPagamentos({ pagamentos, anulados = [] }: { pagamentos: PagamentoView[]; anulados?: AnuladoAntesDaConfirmacao[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pendentes = pagamentos.filter((p) => !p.confirmado);
  if (pendentes.length === 0 && anulados.length === 0) return null;
  return (
    <div className="mt-4 border-t border-sage-200 pt-3" data-testid="confirmar-pagamentos">
      <p className="mb-2 text-xs font-semibold uppercase text-muted">Pagamentos para confirmar</p>
      <ul className="space-y-2">
        {pendentes.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-ink">
              {p.rotulo} · pago em {dataBR(p.dataPagamento)}, por {FORMA[p.forma] ?? p.forma}
              {/* E1072: o que o registro cobre além do aluguel, para o morador confirmar o total que pagou. */}
              {p.componentes && textoComponentes(p.componentes) && (
                <span className="block text-xs text-muted" data-testid="pagamento-componentes">
                  Este registro: {textoComponentes(p.componentes)}.
                </span>
              )}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={ocupado === p.id}
              onClick={async () => {
                setOcupado(p.id);
                setErro(null);
                const r = await confirmarPagamento(p.id).catch(() => ({ ok: false, error: "Falha de conexão." }));
                setOcupado(null);
                if (!r.ok) return setErro(r.error ?? "Não foi possível confirmar.");
                router.refresh();
              }}
            >
              <Check className="h-4 w-4" /> Confirmar
            </Button>
          </li>
        ))}
        {/* E1241: o registro que o dono anulou antes de o morador confirmar — só a linha e o selo. */}
        {anulados.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm text-muted" data-testid="pagamento-anulado-pendente">
            {a.rotulo}
            <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">{textoDoSeloAnulado(a.motivo)}</span>
          </li>
        ))}
      </ul>
      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
      <p className="mt-2 text-[11px] text-muted">Confirme só o que você realmente pagou. Ao confirmar, o recibo em PDF fica disponível aqui e vai por e-mail para você e para o proprietário.</p>
    </div>
  );
}
