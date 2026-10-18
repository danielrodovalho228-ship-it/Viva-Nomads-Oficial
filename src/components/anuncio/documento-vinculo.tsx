"use client";

import { useState } from "react";
import { CheckCircle2, Clock, FileText, Loader2, ShieldCheck, Upload, XCircle } from "lucide-react";
import { DOCUMENTOS_ACEITOS_TEXTO, FORMATOS_ACEITOS_TEXTO, type EstadoConferencia } from "@/lib/documento/conferencia";
import { validarArquivoDoc } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";

export type EstadoDocumentoTela = EstadoConferencia | "nenhum";

/** document_status do servidor → estado da tela. */
export function estadoDoStatus(s: "none" | "pending" | "approved" | "rejected"): EstadoDocumentoTela {
  return s === "approved" ? "aprovado" : s === "rejected" ? "corrija" : s === "pending" ? "revisao" : "nenhum";
}

/**
 * Documento de vínculo com o imóvel, na etapa 1 do cadastro (prompt 11). Envia pelo MESMO /api/upload/documento
 * (bucket privado, tipo real conferido no servidor) e pede a conferência automática na hora:
 *   ✓ Documentação conferida · ✕ Corrija (motivo + reenviar aqui mesmo) · ⏱ Em revisão (equipe, até 48 h).
 * O documento nunca aparece no anúncio; o CPF nunca volta para a tela.
 */
export function DocumentoVinculo({
  imovelId,
  endereco,
  operacao,
  estado,
  motivos,
  onResultado,
}: {
  imovelId: string | null;
  endereco: { cep: string; rua: string; numero: string; bairro: string; cidade: string };
  operacao: string;
  estado: EstadoDocumentoTela;
  motivos: string[];
  onResultado: (estado: EstadoDocumentoTela, motivos: string[]) => void;
}) {
  const [enviando, setEnviando] = useState<"enviando" | "conferindo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const enderecoPronto = endereco.cep.replace(/\D/g, "").length === 8 && !!endereco.rua.trim() && !!endereco.numero.trim();

  async function enviar(file: File | undefined) {
    if (!file) return;
    setErro(null);
    const invalido = validarArquivoDoc({ type: file.type, size: file.size });
    if (invalido) return setErro(invalido);
    setNome(file.name);
    setEnviando("enviando");
    try {
      const form = new FormData();
      form.append("file", file);
      const up = await fetch("/api/upload/documento", { method: "POST", body: form });
      const upJson = (await up.json().catch(() => ({}))) as { path?: string | null; demo?: boolean; error?: string };
      if (!up.ok) throw new Error(upJson.error ?? "Não foi possível enviar o documento agora.");
      if (!upJson.path) {
        // Demonstração (sem backend): nada a conferir.
        onResultado("revisao", ["Modo de demonstração: o documento não foi gravado."]);
        return;
      }
      setEnviando("conferindo");
      const res = await fetch("/api/documentos/conferir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: upJson.path, imovelId, endereco, operacao }),
      });
      const r = (await res.json().catch(() => ({}))) as { estado?: EstadoConferencia; motivos?: string[]; error?: string };
      if (!res.ok || !r.estado) throw new Error(r.error ?? "Não foi possível conferir o documento agora.");
      onResultado(r.estado, r.motivos ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o documento agora.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="rounded-xl border border-sage-200 p-4" data-testid="documento-vinculo">
      <p className="text-sm font-semibold text-ink">Documento do imóvel</p>
      <p className="mt-0.5 text-xs text-muted">
        Conferimos o documento na hora (o documento, não a propriedade). Ele fica em armazenamento privado e nunca
        aparece no anúncio.
      </p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-ink" data-testid="documentos-aceitos">
        {DOCUMENTOS_ACEITOS_TEXTO.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-muted">{FORMATOS_ACEITOS_TEXTO} No nome do proprietário e com o endereço do imóvel.</p>

      {estado === "aprovado" && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-900" data-testid="documento-estado" data-estado="aprovado">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Documentação conferida ✓
        </p>
      )}
      {estado === "corrija" && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" data-testid="documento-estado" data-estado="corrija">
          <p className="flex items-center gap-2 font-semibold">
            <XCircle className="h-4 w-4 shrink-0" /> Corrija o documento
          </p>
          {motivos.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-6" data-testid="documento-motivos">
              {motivos.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs">Envie outro documento aqui mesmo.</p>
        </div>
      )}
      {estado === "revisao" && (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="documento-estado" data-estado="revisao">
          <p className="flex items-center gap-2 font-semibold">
            <Clock className="h-4 w-4 shrink-0" /> Em revisão
          </p>
          <p className="mt-0.5 text-xs">
            Nossa equipe confere em até 48 horas e avisa por e-mail. Você pode seguir o cadastro; a publicação libera depois
            da conferência.
          </p>
        </div>
      )}

      <label
        className={cn(
          "mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-sage-200 px-4 py-3 text-sm font-medium text-forest hover:border-sage",
          (!enderecoPronto || !!enviando) && "pointer-events-none opacity-60",
        )}
        data-testid="documento-enviar"
      >
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : estado === "nenhum" ? <Upload className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        {enviando === "enviando"
          ? "Enviando…"
          : enviando === "conferindo"
            ? "Conferindo o documento…"
            : estado === "nenhum"
              ? "Enviar documento"
              : "Enviar outro documento"}
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="sr-only"
          disabled={!enderecoPronto || !!enviando}
          onChange={(e) => {
            void enviar(e.target.files?.[0]);
            e.target.value = "";
          }}
          aria-label="Enviar documento do imóvel"
        />
      </label>
      {!enderecoPronto && <p className="mt-1 text-xs text-muted">Preencha o CEP, a rua e o número acima para enviar.</p>}
      {nome && !enviando && <p className="mt-1 truncate text-xs text-muted">Último envio: {nome}</p>}
      {erro && <p className="mt-1 text-sm text-red-600">{erro}</p>}
      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
        <span>Seu CPF aparece sempre mascarado. Só a equipe de verificação vê o arquivo, e só quando precisa conferir.</span>
      </p>
    </div>
  );
}
