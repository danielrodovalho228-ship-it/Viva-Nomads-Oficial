"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, FileText, Loader2, Upload } from "lucide-react";
import { linkDocInquilino, listarDocsInquilino, type DocInquilinoResumo } from "@/lib/data/documentos-inquilino-actions";
import { DOCS_INQUILINO, documentosInquilinoCompletos, type TipoDocInquilino } from "@/lib/documentos-inquilino";
import { validarArquivoDoc } from "@/lib/upload-limits";

function dataBR(iso: string): string {
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * Documentos do inquilino de UMA candidatura aceita.
 * modo "inquilino": envia/substitui (identidade + renda ou vínculo).
 * modo "dono": só vê o que chegou e abre por link de 10 minutos.
 */
export function DocumentosInquilino({ leadId, modo }: { leadId: string; modo: "inquilino" | "dono" }) {
  const [docs, setDocs] = useState<DocInquilinoResumo[] | null>(null);
  const [enviando, setEnviando] = useState<TipoDocInquilino | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(() => {
    listarDocsInquilino(leadId)
      .then(setDocs)
      .catch(() => setDocs([]));
  }, [leadId]);
  useEffect(recarregar, [recarregar]);

  async function enviar(tipo: TipoDocInquilino, file: File | undefined) {
    if (!file) return;
    setErro(null);
    const invalido = validarArquivoDoc({ type: file.type, size: file.size });
    if (invalido) return setErro(invalido);
    setEnviando(tipo);
    try {
      const fd = new FormData();
      fd.append("leadId", leadId);
      fd.append("tipo", tipo);
      fd.append("file", file);
      const res = await fetch("/api/upload/inquilino-doc", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setErro(data.error ?? "Não foi possível enviar agora.");
      recarregar();
    } catch {
      setErro("Não foi possível enviar agora. Tente de novo.");
    } finally {
      setEnviando(null);
    }
  }

  async function abrir(tipo: TipoDocInquilino) {
    setErro(null);
    const r = await linkDocInquilino(leadId, tipo).catch(() => ({ ok: false, error: "Não foi possível abrir agora." }) as const);
    if (r.ok && "url" in r && r.url) window.open(r.url, "_blank", "noopener,noreferrer");
    else setErro(("error" in r && r.error) || "Não foi possível abrir agora.");
  }

  if (docs === null) return null;
  const enviados = new Map(docs.map((d) => [d.tipo, d]));
  const completos = documentosInquilinoCompletos(enviados.keys());
  if (modo === "dono" && docs.length === 0) {
    return (
      <p className="text-sm text-muted" data-testid="docs-inquilino">
        O inquilino ainda não enviou os documentos (identidade e comprovante de renda ou vínculo).
      </p>
    );
  }

  return (
    <div data-testid="docs-inquilino">
      <p className="text-sm font-semibold text-ink">
        {modo === "inquilino" ? "Documentos para o contrato" : "Documentos do inquilino"}
        {completos && (
          <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700" data-testid="docs-inquilino-completos">
            <CheckCircle2 className="h-3.5 w-3.5" /> completos
          </span>
        )}
      </p>
      {modo === "inquilino" && (
        <p className="mt-1 text-xs text-muted">
          Envie a identidade e um comprovante de renda <strong>ou</strong> de vínculo. Ficam em armazenamento privado: só você, o
          proprietário desta candidatura e a equipe de verificação abrem, por link temporário.
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {DOCS_INQUILINO.filter((d) => modo === "inquilino" || enviados.has(d.tipo)).map((d) => {
          const ok = enviados.get(d.tipo);
          return (
            <li key={d.tipo} className="rounded-lg border border-sage-200 px-3 py-2" data-testid={`doc-inquilino-${d.tipo}`}>
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-forest" />
                <span className="min-w-0 flex-1 text-sm text-ink">{d.titulo}</span>
                {ok ? (
                  <span className="text-xs text-emerald-700">enviado {dataBR(ok.enviadoEm)}</span>
                ) : (
                  <span className="text-xs text-muted">pendente</span>
                )}
              </div>
              {modo === "inquilino" && <p className="mt-0.5 text-xs text-muted">{d.ajuda}</p>}
              <div className="mt-2 flex flex-wrap gap-3">
                {ok && (
                  <button type="button" onClick={() => abrir(d.tipo)} className="inline-flex items-center gap-1 text-xs font-medium text-forest hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir (link de 10 min)
                  </button>
                )}
                {modo === "inquilino" && (
                  <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-forest hover:underline">
                    {enviando === d.tipo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {enviando === d.tipo ? "Enviando…" : ok ? "Trocar arquivo" : "Enviar arquivo"}
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      className="sr-only"
                      aria-label={`Enviar ${d.titulo.toLowerCase()}`}
                      disabled={enviando !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        void enviar(d.tipo, f);
                      }}
                    />
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {erro}
        </p>
      )}
    </div>
  );
}
