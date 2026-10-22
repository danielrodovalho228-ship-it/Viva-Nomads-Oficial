"use client";

import { dataHoraBRT } from "@/lib/datas-brasilia";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { avisarFilaDocumentosMudou } from "@/lib/admin/fila-evento";
import { Check, ExternalLink, FileText, X } from "lucide-react";
import { Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { decidirMatriculaAdmin, type MatriculaNaFila } from "@/lib/data/matriculas-admin";
import type { ContadoresMatricula } from "@/lib/documento/fila-matricula";
import { MOTIVOS_RECUSA, comporMotivoRecusa } from "@/lib/moderacao-doc";
import { cn } from "@/lib/utils";

/**
 * Matrículas (prompt 19): a matrícula ao lado do resumo lido e do laudo CAF (só os booleanos). Em revisão e as
 * "prováveis" (amostra) ficam aqui até a equipe decidir: Aprovar / Pedir documento (motivo da tabela) / Recusar.
 */
export function MatriculasAdmin({ itens, contadores }: { itens: MatriculaNaFila[]; contadores: ContadoresMatricula }) {
  const [fila, setFila] = useState(itens);
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Prompt 36, item 3b: a matrícula decidida também sai do selo da barra lateral, sem recarregar.
  function decidida(id: string) {
    setFila((f) => f.filter((x) => x.id !== id));
    avisarFilaDocumentosMudou();
    startTransition(() => router.refresh());
  }
  return (
    <section className="mt-8" data-testid="matriculas-admin" aria-labelledby="matriculas-titulo">
      <h2 id="matriculas-titulo" className="font-title text-xl font-semibold text-ink">
        Matrículas — conferência do dono
      </h2>
      <p className="mt-1 text-sm text-muted">Cruzamos a matrícula com o CPF do perfil e a confirmação de identidade. Não consultamos o cartório.</p>

      {/* Grade par: 4 caixas. */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="matriculas-contadores">
        {[
          { rotulo: "Conferidos automático", valor: String(contadores.conferidos) },
          { rotulo: "Prováveis (amostra)", valor: String(contadores.provaveis) },
          { rotulo: "Em revisão", valor: String(contadores.emRevisao) },
          { rotulo: "Tempo médio da equipe", valor: contadores.tempoMedioHoras == null ? "—" : `${contadores.tempoMedioHoras} h` },
        ].map((c) => (
          <div key={c.rotulo} className="rounded-xl border border-sage-200 bg-white p-3">
            <p className="font-title text-2xl font-semibold text-forest">{c.valor}</p>
            <p className="text-xs text-muted">{c.rotulo}</p>
          </div>
        ))}
        <p className="col-span-2 text-xs text-muted lg:col-span-4">Últimos 30 dias.</p>
      </div>

      <div className="mt-4 space-y-3">
        {fila.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhuma matrícula na fila" text="As conferidas automaticamente não precisam de você." />
        ) : (
          fila.map((m) => <MatriculaCard key={m.id} m={m} onDecidido={() => decidida(m.id)} />)
        )}
      </div>
    </section>
  );
}

function Sim({ ok, rotulo }: { ok: boolean; rotulo: string }) {
  return (
    <li className={cn("flex items-center gap-2", ok ? "text-green-800" : "text-red-700")}>
      {ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />} {rotulo}
    </li>
  );
}

function MatriculaCard({ m, onDecidido }: { m: MatriculaNaFila; onDecidido: () => void }) {
  const [modo, setModo] = useState<"pedir" | "recusar" | null>(null);
  const [motivo, setMotivo] = useState<string>("");
  const [detalhe, setDetalhe] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function decidir(acao: "aprovar" | "pedir" | "recusar") {
    setErro(null);
    let texto: string | undefined;
    if (acao !== "aprovar") {
      const t = comporMotivoRecusa(motivo, detalhe);
      if (!t) return setErro(motivo === "outro" ? "Descreva o motivo." : "Escolha o motivo.");
      texto = t;
    }
    setBusy(true);
    const r = await decidirMatriculaAdmin(m.id, acao, texto);
    setBusy(false);
    if (!r.ok) return setErro(r.error ?? "Não foi possível salvar.");
    onDecidido();
  }

  return (
    <div data-testid="matricula-card" data-resultado={m.resultado}>
      <Panel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="font-medium text-ink">
              {m.ownerNome}
              <span className="font-normal text-muted"> · {m.tituloImovel ?? "sem imóvel ligado ainda"}</span>
            </p>
            <p className="text-xs text-muted">
              {m.resultadoRotulo}
              {m.motivoRotulo && ` · ${m.motivoRotulo}`} · enviada em {dataHoraBRT(m.criadaEm)}
            </p>
            {m.arquivoUrl &&
              (m.arquivoTipo === "imagem" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.arquivoUrl} alt="Matrícula enviada" className="mt-3 max-h-96 w-full rounded-lg border border-sage-200 object-contain" />
              ) : m.arquivoTipo === "pdf" ? (
                <iframe src={m.arquivoUrl} title="Matrícula enviada" className="mt-3 h-96 w-full rounded-lg border border-sage-200" />
              ) : null)}
            {m.arquivoUrl && (
              <a href={m.arquivoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-forest underline">
                Abrir a matrícula <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
          </div>
          <div className="min-w-0 space-y-3 text-sm">
            <div data-testid="matricula-resumo">
              <p className="font-semibold text-ink">O que foi lido</p>
              <ul className="mt-1 space-y-1 text-ink">
                {m.resumo.length ? m.resumo.map((r) => <li key={r}>{r}</li>) : <li className="text-muted">Nada legível.</li>}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-ink">Proprietários</p>
              <ul className="mt-1 space-y-1 text-ink" data-testid="matricula-proprietarios">
                {m.proprietarios.length ? m.proprietarios.map((p) => <li key={p}>{p}</li>) : <li className="text-muted">Nenhum lido.</li>}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-ink">Ônus em aberto</p>
              <ul className="mt-1 space-y-1 text-ink" data-testid="matricula-onus">
                {m.onus.length ? m.onus.map((o) => <li key={o}>{o}</li>) : <li className="text-muted">Nenhum.</li>}
              </ul>
            </div>
            <div data-testid="matricula-caf-laudo">
              <p className="font-semibold text-ink">Confirmação de identidade (CAF){m.caf?.simulado ? " — simulada" : ""}</p>
              {m.caf ? (
                <ul className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  <Sim ok={m.caf.identidade} rotulo="Identidade" />
                  <Sim ok={m.caf.documento} rotulo="Documento" />
                  <Sim ok={m.caf.provaDeVida} rotulo="Prova de vida" />
                </ul>
              ) : (
                <p className="mt-1 text-muted">Ainda não feita.</p>
              )}
            </div>
            {m.caso && (
              <p className="rounded-lg bg-surface-2 px-3 py-2" data-testid="matricula-caso-admin">
                Caso informado: <strong>{m.caso}</strong>
                {m.casoUrl && (
                  <>
                    {" · "}
                    <a href={m.casoUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-forest underline">
                      abrir o documento
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        {modo && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="input" aria-label="Motivo" data-testid="matricula-motivo">
              <option value="">Escolha o motivo…</option>
              {MOTIVOS_RECUSA.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <input value={detalhe} onChange={(e) => setDetalhe(e.target.value.slice(0, 300))} className="input" placeholder="Detalhe (opcional)" aria-label="Detalhe do motivo" />
          </div>
        )}
        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {modo ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => void decidir(modo)} data-testid="matricula-confirmar">
                {modo === "pedir" ? "Enviar pedido ao dono" : "Confirmar recusa"}
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => setModo(null)}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => void decidir("aprovar")} data-testid="matricula-aprovar">
                Aprovar
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => setModo("pedir")} data-testid="matricula-pedir">
                Pedir documento
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => setModo("recusar")} data-testid="matricula-recusar">
                Recusar
              </Button>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
