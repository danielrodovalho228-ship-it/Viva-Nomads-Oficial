"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Resposta = {
  ok?: boolean;
  conferidor?: string;
  modelo?: string | null;
  falha?: { status: number | null; tipo: string; resumo: string | null } | null;
  lido?: Record<string, unknown> | null;
  erro?: string;
};

/**
 * Prompt 25: "Testar leitura" no painel da IA (só admin). Envia um arquivo FICTÍCIO (a matrícula de tests/fixtures)
 * para a MESMA leitura do cadastro, com a chave de produção, e mostra o resultado — inclusive a mensagem exata da API
 * num erro 400. Nada do arquivo é guardado.
 */
export function TestarLeituraIa() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tipo, setTipo] = useState<"matricula" | "documento">("matricula");
  const [ocupado, setOcupado] = useState(false);
  const [r, setR] = useState<Resposta | null>(null);

  async function testar() {
    if (!arquivo) return;
    setOcupado(true);
    setR(null);
    const corpo = new FormData();
    corpo.set("arquivo", arquivo);
    corpo.set("tipo", tipo);
    const res = await fetch("/api/admin/ia-diagnostico", { method: "POST", body: corpo }).catch(() => null);
    setR(res ? ((await res.json().catch(() => ({ erro: `HTTP ${res.status}` }))) as Resposta) : { erro: "Sem resposta do servidor." });
    setOcupado(false);
  }

  return (
    <div className="mt-4 border-t border-sage-200 pt-4" data-testid="testar-leitura-ia">
      <p className="text-sm font-semibold text-ink">Testar leitura (arquivo fictício)</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value === "documento" ? "documento" : "matricula")}
          className="rounded-lg border border-sage-200 bg-white px-2 py-2 text-sm"
          data-testid="testar-leitura-tipo"
        >
          <option value="matricula">Matrícula</option>
          <option value="documento">Documento</option>
        </select>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="min-w-0 max-w-full text-sm"
          data-testid="testar-leitura-arquivo"
        />
        <Button size="sm" variant="primary" disabled={!arquivo || ocupado} onClick={testar} data-testid="testar-leitura-enviar">
          {ocupado ? "Lendo..." : "Testar"}
        </Button>
      </div>
      {r && (
        <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-3 text-xs text-ink" data-testid="testar-leitura-resultado">
          {JSON.stringify(r, null, 2)}
        </pre>
      )}
    </div>
  );
}
