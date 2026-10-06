"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { dataBR } from "@/lib/fiscal/documento";
import type { AcertoView, DocumentoView } from "@/lib/data/documentos-actions";
import { registrarDevolucaoCaucao, responderDevolucaoCaucao } from "@/lib/data/documentos-actions";
import { confirmarPagamento, type PagamentoView } from "@/lib/data/contratos-actions";

/**
 * Documentos do contrato e devolução da caução — mesmas peças em "Contratos &
 * blocos" (proprietário) e "Minhas locações" (inquilino). Nada aqui movimenta
 * dinheiro: a plataforma registra, a outra parte confirma, e o PDF sai.
 */

const input = "mt-1 w-full rounded-lg border border-sage-200 bg-white px-2 py-1.5 text-sm text-ink outline-none focus:border-sage";

export function ListaDocumentos({ documentos }: { documentos: DocumentoView[] }) {
  if (documentos.length === 0) return null;
  return (
    <div className="mt-4 border-t border-sage-200 pt-3" data-testid="documentos-contrato">
      <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <FileText className="h-3.5 w-3.5" /> Documentos
      </p>
      <ul className="space-y-1.5">
        {documentos.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="min-w-0 text-ink">
              {d.rotulo} <span className="text-muted">· {d.numero} · {formatBRL(d.valor)}</span>
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

const STATUS_ACERTO: Record<string, string> = {
  aguardando_confirmacao: "aguardando a confirmação do inquilino",
  devolvida_integral: "devolução confirmada pelo inquilino",
  desconto_confirmado: "devolução com descontos confirmada pelo inquilino",
  desconto_contestado: "contestada pelo inquilino — fale pela Central de Ajuda",
};

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

  if (acerto && acerto.status !== "desconto_contestado") {
    return (
      <p className="mt-3 text-xs text-muted" data-testid="devolucao-caucao">
        Caução: devolvidos {formatBRL(acerto.valorDevolvido)} de {formatBRL(acerto.caucaoTotal)} em {dataBR(acerto.dataDevolucao)} — {STATUS_ACERTO[acerto.status] ?? acerto.status}.
      </p>
    );
  }
  if (!encerrado || caucaoConfirmada <= 0) return null;
  if (!aberto) {
    return (
      <div className="mt-3" data-testid="devolucao-caucao">
        {acerto?.status === "desconto_contestado" && <p className="mb-2 text-xs text-amber-800">A devolução anterior foi contestada pelo inquilino.</p>}
        <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
          Registrar devolução da caução
        </Button>
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-xl border border-sage-200 bg-white p-3" data-testid="devolucao-caucao">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink">
        <ShieldCheck className="h-3.5 w-3.5 text-sage" /> Devolução da caução — você devolve direto ao inquilino; a plataforma só registra
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-muted">
          Valor devolvido (caução: {formatBRL(caucaoConfirmada)})
          <input type="number" min={0} max={caucaoConfirmada} value={valor} onChange={(e) => setValor(e.target.value)} className={input} />
        </label>
        <label className="text-xs text-muted">
          Data
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={input} />
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
      {Number(valor) < caucaoConfirmada && <p className="mt-2 text-[11px] text-amber-800">Com desconto, explique os motivos ao inquilino (com fotos da vistoria) pela conversa antes de registrar.</p>}
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
  if (!acerto) return null;
  if (acerto.status !== "aguardando_confirmacao") {
    return (
      <p className="mt-3 text-xs text-muted" data-testid="devolucao-caucao">
        Caução: {formatBRL(acerto.valorDevolvido)} de {formatBRL(acerto.caucaoTotal)} — {STATUS_ACERTO[acerto.status] ?? acerto.status}.
      </p>
    );
  }
  const responder = async (r: "confirmar" | "contestar") => {
    setOcupado(true);
    setErro(null);
    const res = await responderDevolucaoCaucao(acerto.id, r).catch(() => ({ ok: false as const, error: "Falha de conexão." }));
    setOcupado(false);
    if (!res.ok) return setErro(res.error);
    router.refresh();
  };
  return (
    <div className="mt-3 rounded-xl border border-champagne bg-champagne/10 p-3 text-sm" data-testid="devolucao-caucao">
      <p className="text-ink">
        O proprietário registrou a devolução de <strong>{formatBRL(acerto.valorDevolvido)}</strong> da caução de {formatBRL(acerto.caucaoTotal)}, em {dataBR(acerto.dataDevolucao)}. Você recebeu?
      </p>
      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="gold" disabled={ocupado} onClick={() => responder("confirmar")}>
          <Check className="h-4 w-4" /> Sim, recebi
        </Button>
        <Button size="sm" variant="outline" disabled={ocupado} onClick={() => responder("contestar")}>
          Não recebi / discordo
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted">Confirmando, sai o termo de devolução em PDF para os dois.</p>
    </div>
  );
}

const FORMA: Record<string, string> = { pix: "Pix", boleto: "boleto", transferencia: "transferência", dinheiro: "dinheiro", outro: "outra forma" };

/** Inquilino: confirma os pagamentos que o proprietário registrou → recibo/comprovante. */
export function ConfirmarPagamentos({ pagamentos }: { pagamentos: PagamentoView[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pendentes = pagamentos.filter((p) => !p.confirmado);
  if (pendentes.length === 0) return null;
  return (
    <div className="mt-4 border-t border-sage-200 pt-3" data-testid="confirmar-pagamentos">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Pagamentos para confirmar</p>
      <ul className="space-y-2">
        {pendentes.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-ink">
              {p.tipo === "caucao" ? "Caução" : "Aluguel"} de {formatBRL(p.valor)} em {dataBR(p.dataPagamento)}, por {FORMA[p.forma] ?? p.forma}
            </span>
            <Button
              size="sm"
              variant="gold"
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
      </ul>
      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
      <p className="mt-2 text-[11px] text-muted">Confirme só o que você realmente pagou. Ao confirmar, sai o recibo em PDF para você e para o proprietário.</p>
    </div>
  );
}
