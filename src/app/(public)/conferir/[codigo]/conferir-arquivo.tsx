"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { hashConfere, hexDe } from "@/lib/fiscal/conferir";

/**
 * "O arquivo confere?" (Prompt 56, D3): a pessoa escolhe o PDF e o navegador calcula o SHA-256 ali mesmo. O arquivo
 * NÃO é enviado ao servidor; só o resultado da comparação aparece.
 */
export function ConferirArquivo({ hash }: { hash: string }) {
  const [resultado, setResultado] = useState<"confere" | "nao" | "erro" | null>(null);

  const conferir = async (file: File | undefined) => {
    setResultado(null);
    if (!file) return;
    try {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      setResultado(hashConfere(hash, hexDe(digest)) ? "confere" : "nao");
    } catch {
      setResultado("erro");
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-line p-4">
      <label className="grid gap-2 text-sm font-semibold text-ink">
        Conferir o arquivo (PDF)
        <input type="file" accept="application/pdf" onChange={(e) => conferir(e.target.files?.[0])} className="block w-full min-w-0 max-w-full text-sm font-normal text-ink" data-testid="conferir-arquivo" />
      </label>
      <p className="mt-1 text-xs text-muted">O arquivo não sai do seu aparelho: a comparação é feita no seu navegador.</p>
      {resultado === "confere" && (
        <p className="mt-3 inline-flex items-start gap-2 text-sm font-semibold text-forest" data-testid="conferir-hash-ok">
          <CheckCircle2 className="mt-1 h-5 w-5 shrink-0" /> O arquivo confere: é o documento registrado, sem alteração.
        </p>
      )}
      {resultado === "nao" && (
        <p className="mt-3 inline-flex items-start gap-2 text-sm font-semibold text-red-700" data-testid="conferir-hash-falhou">
          <XCircle className="mt-1 h-5 w-5 shrink-0" /> O arquivo NÃO confere: ele foi alterado ou não é este documento.
        </p>
      )}
      {resultado === "erro" && <p className="mt-3 text-sm text-red-700">Não foi possível ler o arquivo neste navegador.</p>}
    </div>
  );
}
