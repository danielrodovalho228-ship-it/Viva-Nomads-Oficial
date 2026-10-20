"use client";

import { useState } from "react";
import { textoFilaDocumentos, FORMULA_FILA_DOCUMENTOS } from "@/lib/admin/indicadores";
import { dataBRT, dataHoraBRT } from "@/lib/datas-brasilia";
import {
  FileText,
  ExternalLink,
  Check,
  X,
  ShieldCheck,
  AlertTriangle,
  User,
  Home,
} from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import {
  moderarDocumento,
  reabrirConferencia,
  type ConferidoAutomatico,
  type ConferenciaResumo,
  type DocumentoPendente,
} from "@/lib/data/documentos-admin";
import {
  CHECKLIST_CONFERENCIA,
  MOTIVOS_RECUSA,
  conferenciaCompleta,
  comporMotivoRecusa,
} from "@/lib/moderacao-doc";
import { cn } from "@/lib/utils";

/**
 * Fila de CONFERÊNCIA dos documentos de imóvel (matrícula / contrato de gestão).
 * O admin vê o documento inline, compara nome/imóvel com o cadastro, marca o
 * checklist de conferência e só então aprova; recusa exige motivo estruturado.
 * Só aprovado libera o proprietário a publicar; e-mail sai nos dois desfechos.
 *
 * Nota (jurídico): conferimos o DOCUMENTO — não atestamos propriedade. Ver a
 * regra de vocabulário em scripts/check-consistency.mjs.
 */
export function AdminDocumentosClient({
  docs,
  auto = [],
  contadores = { automaticos: 0, corrija: 0, revisao: 0 },
  filaAgora = null,
}: {
  docs: DocumentoPendente[];
  auto?: ConferidoAutomatico[];
  contadores?: { automaticos: number; corrija: number; revisao: number };
  /** "Na fila agora" (Prompt 29, item 9): documentos + matrículas — a mesma função da home e do selo da barra lateral. */
  filaAgora?: { documentos: number; matriculas: number; total: number; maisAntigoEm: string | null } | null;
}) {
  const [fila, setFila] = useState(docs);
  const [aba, setAba] = useState<"revisao" | "automaticos">("revisao");
  const [autos, setAutos] = useState(auto);

  function sair(id: string) {
    setFila((f) => f.filter((d) => d.id !== id));
  }

  return (
    <div>
      <PageTitle
        title="Documentos em conferência"
        subtitle="A conferência automática aprova o que bate e devolve ao dono o que está claramente errado. Aqui ficam só os casos em revisão. Conferimos o documento, não atestamos a propriedade."
      />

      {/* Prompt 29, item 9: "Na fila agora" é a soma explicada (documentos + matrículas); os 7 dias são outra métrica. */}
      {filaAgora && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3" data-testid="fila-agora">
          <p className="font-title text-lg font-bold text-ink">
            <span data-testid="fila-agora-total">{filaAgora.total}</span> na fila agora{" "}
            <span className="text-base font-medium text-muted">({textoFilaDocumentos(filaAgora).replace(/^\d+ na fila \(|\)$/g, "")})</span>
          </p>
          <p className="text-xs text-muted">
            {FORMULA_FILA_DOCUMENTOS}
            {filaAgora.maisAntigoEm ? ` Mais antigo: ${dataHoraBRT(filaAgora.maisAntigoEm)}.` : ""}
          </p>
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="conferencia-contadores">
        {[
          { rotulo: "Aprovados automaticamente", valor: contadores.automaticos },
          { rotulo: "Corrija (devolvidos ao dono)", valor: contadores.corrija },
          { rotulo: "Foram para revisão", valor: contadores.revisao },
          { rotulo: "Documentos de imóvel em revisão", valor: fila.length },
        ].map((c) => (
          <div key={c.rotulo} className="rounded-xl border border-sage-200 bg-white p-3">
            <p className="font-title text-2xl font-bold text-forest">{c.valor}</p>
            <p className="text-xs text-muted">{c.rotulo}</p>
          </div>
        ))}
        <p className="col-span-2 text-xs text-muted lg:col-span-4">Aprovados, devolvidos e &quot;foram para revisão&quot;: últimos 7 dias. Em revisão: agora.</p>
      </div>

      <div className="mb-4 flex gap-2" role="tablist">
        {(
          [
            ["revisao", `Em revisão (${fila.length})`],
            ["automaticos", `Conferidos automaticamente (${autos.length})`],
          ] as const
        ).map(([k, rotulo]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={aba === k}
            onClick={() => setAba(k)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              aba === k ? "bg-forest text-white" : "bg-sage-100 text-forest hover:bg-sage-200",
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === "automaticos" ? (
        autos.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Nenhum ainda" text="Os documentos aprovados pela conferência automática aparecem aqui para amostragem." />
        ) : (
          <div className="space-y-4" data-testid="conferidos-automaticamente">
            {autos.map((a) => (
              <AutoCard key={a.id} doc={a} onReaberto={() => setAutos((l) => l.filter((x) => x.id !== a.id))} />
            ))}
          </div>
        )
      ) : fila.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nada na fila"
          text="Não há documentos aguardando conferência no momento."
        />
      ) : (
        <div className="space-y-4">
          {fila.map((d) => (
            <DocCard key={d.id} doc={d} onDone={() => sair(d.id)} />
          ))}
        </div>
      )}

      {/* fim das abas */}
      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid var(--color-sage-200);background:#fff;padding:0.625rem 0.875rem;font-size:0.875rem;outline:none}.input:focus{border-color:var(--color-sage)}`}</style>
    </div>
  );
}

/** O que a conferência automática leu e por que o caso veio para a revisão (o admin decide). */
function ConferenciaIaBox({ c, revisaoAte }: { c: ConferenciaResumo; revisaoAte?: string | null }) {
  const [agora] = useState(() => Date.now());
  const vencido = !!revisaoAte && Date.parse(revisaoAte) < agora;
  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="conferencia-ia">
      <p className="font-semibold">Conferência automática</p>
      {c.motivos.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5" data-testid="conferencia-ia-motivos">
          {c.motivos.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      {c.leitura && (
        <p className="mt-1 text-xs">
          Leu: {[c.leitura.tipo, c.leitura.titular, c.leitura.endereco, c.leitura.data, c.leitura.cpf].filter(Boolean).join(" · ") || "nada legível"}
          {c.leitura.sinais.length > 0 && ` · sinais: ${c.leitura.sinais.join(", ")}`}
        </p>
      )}
      {revisaoAte && (
        <p className={cn("mt-1 text-xs font-semibold", vencido ? "text-red-700" : "text-amber-900")} data-testid="conferencia-prazo">
          {vencido ? "Prazo de 48 h vencido" : `Prazo: até ${dataHoraBRT(revisaoAte)}`}
        </p>
      )}
    </div>
  );
}

function AutoCard({ doc, onReaberto }: { doc: ConferidoAutomatico; onReaberto: () => void }) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div data-testid="auto-card">
      <Panel>
        <p className="font-medium text-ink">
          {doc.ownerNome}
          <span className="font-normal text-muted"> · {doc.tituloImovel ?? "sem imóvel ligado ainda"}</span>
        </p>
        <p className="text-xs text-muted">Aprovado em {dataBRT(doc.criadoEm)}</p>
        {doc.conferencia && (
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {CHECKLIST_CONFERENCIA.map((i) => (
              <li key={i.key} className="flex items-center gap-1.5">
                {doc.conferencia?.checklist[i.key] ? <Check className="h-4 w-4 text-forest" /> : <X className="h-4 w-4 text-red-600" />}
                {i.label}
              </li>
            ))}
          </ul>
        )}
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-medium text-forest">Ver o que a conferência leu</summary>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-surface-2 p-2" data-testid="auto-card-json">{JSON.stringify(doc.conferencia, null, 2)}</pre>
        </details>
        <div className="mt-3 flex flex-wrap gap-2">
          {doc.docUrl && (
            <a href={doc.docUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:underline">
              <ExternalLink className="h-4 w-4" /> Abrir documento
            </a>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErro(null);
              const r = await reabrirConferencia(doc.id);
              setBusy(false);
              if (!r.ok) return setErro(r.error ?? "Não foi possível reabrir.");
              onReaberto();
            }}
          >
            Reabrir para revisão
          </Button>
        </div>
        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      </Panel>
    </div>
  );
}

function DocCard({ doc, onDone }: { doc: DocumentoPendente; onDone: () => void }) {
  // Checklist PRÉ-MARCADO pela conferência automática (o admin confere e ajusta).
  const [marks, setMarks] = useState<Record<string, boolean>>(() => ({ ...(doc.conferenciaIa?.checklist ?? {}) }));
  const [rejeitando, setRejeitando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeAprovar = conferenciaCompleta(marks);
  const motivoFinal = comporMotivoRecusa(motivo, detalhe);

  async function aprovar() {
    setBusy(true);
    setErro(null);
    const res = await moderarDocumento(doc.id, true);
    setBusy(false);
    if (!res.ok) return setErro(res.error ?? "Não foi possível registrar a decisão.");
    onDone();
  }

  async function recusar() {
    if (!motivoFinal) return setErro("Escolha o motivo (e descreva, se for 'Outro').");
    setBusy(true);
    setErro(null);
    const res = await moderarDocumento(doc.id, false, motivoFinal);
    setBusy(false);
    if (!res.ok) return setErro(res.error ?? "Não foi possível registrar a decisão.");
    onDone();
  }

  return (
    <div data-testid="doc-card" data-imovel={doc.tituloImovel ?? ""} data-sem-imovel={doc.semImovel ? "1" : undefined} data-dono={doc.ownerNomeCompleto ?? doc.ownerNome}>
    <Panel>
      {/* Cabeçalho: dono + data */}
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage-100">
          <FileText className="h-5 w-5 text-forest" />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {doc.ownerNome}
            <span className="font-normal text-muted">
              {" · "}
              {/* 35A: enviado no /qualificar antes de existir imóvel — liga ao próximo imóvel criado pelo dono. */}
              {doc.semImovel ? "Documento sem imóvel ligado" : doc.tituloImovel ?? "sem imóvel cadastrado ainda"}
            </span>
          </p>
          <p className="text-xs text-muted">
            Enviado {doc.semImovel ? dataHoraBRT(doc.criadoEm) : dataBRT(doc.criadoEm)}
          </p>
        </div>
      </div>

      {doc.conferenciaIa && <ConferenciaIaBox c={doc.conferenciaIa} revisaoAte={doc.revisaoAte} />}

      {/* Alerta de arquivo reutilizado (anti-fraude) */}
      {doc.duplicado > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Arquivo idêntico já enviado por {doc.duplicado} outra(s) conta(s).</strong>{" "}
            Confira se não é reuso indevido de documento antes de aprovar.
          </span>
        </p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Visualizador inline do documento */}
        <div className="rounded-xl border border-sage-200 bg-surface-2 p-2">
          {doc.docUrl ? (
            doc.docTipo === "imagem" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={doc.docUrl}
                alt="Documento do imóvel para conferência"
                className="max-h-80 w-full rounded-lg object-contain"
              />
            ) : doc.docTipo === "pdf" ? (
              <iframe
                src={doc.docUrl}
                title="Documento do imóvel (PDF)"
                className="h-80 w-full rounded-lg bg-white"
              />
            ) : (
              <p className="p-4 text-sm text-muted">Pré-visualização indisponível para este tipo.</p>
            )
          ) : (
            <p className="p-4 text-sm text-muted">Documento indisponível.</p>
          )}
          {doc.docUrl && (
            <a
              href={doc.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-forest hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir em nova aba (tamanho real)
            </a>
          )}
        </div>

        {/* Comparação + checklist de conferência */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Confira contra o cadastro
          </p>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
              <div className="min-w-0">
                <dt className="text-xs text-muted">Titular da conta</dt>
                <dd className="font-medium text-ink">{doc.ownerNomeCompleto ?? doc.ownerNome}</dd>
              </div>
            </div>
            {doc.titularInformado && (
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
                <div className="min-w-0">
                  <dt className="text-xs text-muted">Titular informado pelo dono</dt>
                  <dd className="font-medium text-ink">{doc.titularInformado}</dd>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Home className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
              <div className="min-w-0">
                <dt className="text-xs text-muted">{doc.semImovel ? "Imóvel mais recente do dono" : "Imóvel do cadastro"}</dt>
                <dd className="font-medium text-ink">
                  {doc.refImovel ?? "— (sem imóvel cadastrado ainda)"}
                </dd>
              </div>
            </div>
          </dl>

          {doc.preConferencia && (
            <div
              data-testid="pre-conferencia"
              className={cn(
                "mt-4 rounded-lg border px-3 py-2 text-sm",
                doc.preConferencia.pareceOk ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide">Pré-conferência automática</p>
              <p className="mt-1 font-semibold" data-testid="pre-conferencia-veredito">{doc.preConferencia.veredito}</p>
              <ul className="mt-1.5 space-y-0.5 text-xs">
                {doc.preConferencia.itens.map((i) => (
                  <li key={i.chave}>
                    {i.estado === "ok" ? "✓" : i.estado === "atencao" ? "!" : "–"} {i.rotulo}: {i.detalhe}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] opacity-80">Só uma ajuda. Quem aprova ou recusa é você.</p>
            </div>
          )}
          {doc.autorizacaoUrl && (
            <a
              href={doc.autorizacaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="abrir-autorizacao"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-forest hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {doc.operacao === "managed" ? "Abrir contrato de administração / procuração" : "Abrir autorização de sublocação"}
            </a>
          )}

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
            Checklist de conferência
          </p>
          <div className="mt-2 space-y-1.5">
            {CHECKLIST_CONFERENCIA.map((item) => (
              <label key={item.key} className="flex cursor-pointer items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={!!marks[item.key]}
                  onChange={(e) => setMarks((m) => ({ ...m, [item.key]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-sage-200 accent-forest"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

      {rejeitando ? (
        <div className="mt-4 border-t border-sage-200 pt-4">
          <label className="text-sm font-medium text-ink">Motivo da recusa</label>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="input mt-2">
            <option value="">Selecione um motivo…</option>
            {MOTIVOS_RECUSA.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <textarea
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
            rows={2}
            placeholder={
              motivo === "outro"
                ? "Descreva o motivo (obrigatório)."
                : "Detalhe opcional para o proprietário."
            }
            className="input mt-2"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRejeitando(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              disabled={busy || !motivoFinal}
              onClick={recusar}
            >
              {busy ? "Salvando…" : "Confirmar recusa"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-sage-200 pt-4">
          {doc.bloqueioAprovacao && (
            <span className="mr-auto text-xs font-medium text-amber-700" data-testid="aprovar-bloqueado">
              {doc.bloqueioAprovacao}
            </span>
          )}
          {!podeAprovar && !doc.bloqueioAprovacao && (
            <span className="mr-auto text-xs text-muted">
              Marque todos os itens do checklist para aprovar.
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className={cn("border-red-200 text-red-600 hover:bg-red-50")}
            disabled={busy}
            onClick={() => setRejeitando(true)}
          >
            <X className="h-4 w-4" /> Recusar
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !podeAprovar || !!doc.bloqueioAprovacao}
            title={doc.bloqueioAprovacao ?? (podeAprovar ? undefined : "Conclua o checklist de conferência")}
            onClick={aprovar}
          >
            <Check className="h-4 w-4" /> {busy ? "Salvando…" : "Aprovar"}
          </Button>
        </div>
      )}
    </Panel>
    </div>
  );
}
