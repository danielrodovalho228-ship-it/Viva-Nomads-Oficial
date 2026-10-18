"use client";

import { useState } from "react";
import { AlertTriangle, Clock, Loader2, ShieldCheck, Upload } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { CASOS_DONO, type AvisoMatricula, type CasoDono, type MotivoMatricula, type PreenchimentoMatricula, type ResultadoMatricula } from "@/lib/documento/conferencia-matricula";
import { validarArquivoDoc } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";

/** O que a conferência da matrícula devolve ao dono (nunca CPF, número da matrícula, cartório ou ônus). */
export interface InfoMatricula {
  id: string;
  resultado: ResultadoMatricula;
  motivo: MotivoMatricula | null;
  mensagem: string;
  opcoes: CasoDono[];
  pedirCaf: boolean;
  avisos: AvisoMatricula[];
  preenchimento: PreenchimentoMatricula | null;
}

/**
 * Resultado da matrícula na etapa 1 (prompt 19): falta a identidade (botão da CAF), nome/CPF diferente (escolher o
 * caso e anexar o documento), detalhe da matrícula (sem dizer qual) e os avisos (matrícula antiga, endereço ≠ CEP).
 */
export function MatriculaResultado({
  info,
  onConfirmarIdentidade,
  onTentarDeNovo,
}: {
  info: InfoMatricula;
  onConfirmarIdentidade: () => Promise<string | null>;
  /** Prompt 22: leitura indisponível → confere o MESMO arquivo de novo. */
  onTentarDeNovo?: () => void;
}) {
  const [verificando, setVerificando] = useState(false);
  const [erroCaf, setErroCaf] = useState<string | null>(null);
  const [caso, setCaso] = useState<CasoDono | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroCaso, setErroCaso] = useState<string | null>(null);
  const [casoEnviado, setCasoEnviado] = useState<string | null>(null);
  const emRevisao = info.resultado === "em_revisao";

  async function confirmar() {
    setErroCaf(null);
    setVerificando(true);
    const erro = await onConfirmarIdentidade();
    setVerificando(false);
    if (erro) setErroCaf(erro);
  }

  async function enviarCaso(file: File | undefined) {
    if (!file || !caso) return;
    setErroCaso(null);
    const invalido = validarArquivoDoc({ type: file.type, size: file.size });
    if (invalido) return setErroCaso(invalido);
    setEnviando(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const up = await fetch("/api/upload/documento", { method: "POST", body: form });
      const upJson = (await up.json().catch(() => ({}))) as { path?: string | null; error?: string };
      if (!up.ok || !upJson.path) throw new Error(upJson.error ?? "Não foi possível enviar o documento agora.");
      const res = await fetch("/api/documentos/matricula/caso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: info.id, caso, path: upJson.path }),
      });
      const r = (await res.json().catch(() => ({}))) as { mensagem?: string; error?: string };
      if (!res.ok) throw new Error(r.error ?? "Não foi possível salvar agora.");
      setCasoEnviado(r.mensagem ?? "Documento recebido.");
    } catch (e) {
      setErroCaso(e instanceof Error ? e.message : "Não foi possível enviar o documento agora.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-3 space-y-2" data-testid="matricula-resultado" data-resultado={info.resultado} data-motivo={info.motivo ?? ""}>
      {emRevisao && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="flex items-start gap-2 font-semibold">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" /> <span data-testid="matricula-mensagem">{info.mensagem}</span>
          </p>
          {info.motivo === "falha_indisponivel" && onTentarDeNovo && (
            <button type="button" onClick={onTentarDeNovo} className="mt-2 text-sm font-semibold text-forest underline underline-offset-2" data-testid="matricula-tentar-de-novo">
              Tentar de novo
            </button>
          )}
          {info.motivo === "falta_identidade" && (
            <p className="mt-1 text-xs">
              Confirme sua identidade para a conferência sair na hora. Sem ela, a equipe confere em até 48 horas — você pode seguir o
              cadastro enquanto isso.
            </p>
          )}
        </div>
      )}

      {info.pedirCaf && (
        <div>
          <button type="button" onClick={() => void confirmar()} disabled={verificando} className={buttonClasses({ className: "w-full sm:w-auto disabled:opacity-60" })} data-testid="matricula-caf">
            {verificando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />} Confirmar minha identidade
          </button>
          {erroCaf && (
            <p className="mt-1 text-xs text-red-700" role="alert" data-testid="matricula-caf-erro">
              {erroCaf}
            </p>
          )}
        </div>
      )}

      {info.opcoes.length > 0 && !casoEnviado && (
        <fieldset className="rounded-lg border border-sage-200 p-3" data-testid="matricula-casos">
          <legend className="px-1 text-sm font-semibold text-ink">Qual é o seu caso?</legend>
          <div className="grid grid-cols-1 gap-2">
            {CASOS_DONO.filter((c) => info.opcoes.includes(c.valor)).map((c) => (
              <label
                key={c.valor}
                className={cn("flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm", caso === c.valor ? "border-forest bg-sage-50" : "border-sage-200")}
                data-testid={`matricula-caso-${c.valor}`}
              >
                <input type="radio" name="matricula-caso" className="mt-1" checked={caso === c.valor} onChange={() => setCaso(c.valor)} />
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{c.rotulo}</span>
                  <span className="block text-xs text-muted">Envie: {c.documentos}</span>
                </span>
              </label>
            ))}
          </div>
          <label
            className={cn(
              "mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-sage-200 px-4 py-3 text-sm font-medium text-forest hover:border-sage",
              (!caso || enviando) && "pointer-events-none opacity-60",
            )}
            data-testid="matricula-caso-enviar"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {enviando ? "Enviando…" : caso ? "Anexar o documento do meu caso" : "Escolha o seu caso acima"}
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="sr-only"
              disabled={!caso || enviando}
              onChange={(e) => {
                void enviarCaso(e.target.files?.[0]);
                e.target.value = "";
              }}
              aria-label="Anexar o documento do meu caso"
              data-testid="matricula-caso-arquivo"
            />
          </label>
          {erroCaso && <p className="mt-1 text-sm text-red-600">{erroCaso}</p>}
        </fieldset>
      )}
      {casoEnviado && (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink" role="status" data-testid="matricula-caso-enviado">
          {casoEnviado}
        </p>
      )}

      {info.avisos.length > 0 && (
        <ul className="space-y-1" data-testid="matricula-avisos">
          {info.avisos.map((a) => (
            <li key={a.codigo} className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink" data-codigo={a.codigo}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden /> {a.texto}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
