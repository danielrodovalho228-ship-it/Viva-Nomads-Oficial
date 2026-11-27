"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { MSG_PDF_FALHOU, MSG_PDF_GERANDO, msgPdfBaixado, nomeDoAnexo } from "@/lib/recibos/baixar-pdf";

/*
  E465 — botão que GERA o PDF pela rota, mostra que está gerando, baixa o arquivo e confirma o download (ou mostra o
  erro da rota). Antes era um <a> direto para o anexo: o clique não navegava nem avisava nada.
*/

type Estado = { tipo: "parado" } | { tipo: "gerando" } | { tipo: "pronto"; arquivo: string } | { tipo: "erro"; msg: string };

export function BaixarPdf({ href, rotulo, nomePadrao, testId, className }: { href: string; rotulo: string; nomePadrao: string; testId: string; className?: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "parado" });

  async function baixar() {
    setEstado({ tipo: "gerando" });
    try {
      const r = await fetch(href, { credentials: "same-origin" });
      if (!r.ok || !(r.headers.get("content-type") ?? "").includes("application/pdf")) {
        const corpo = (await r.json().catch(() => null)) as { error?: string } | null;
        setEstado({ tipo: "erro", msg: corpo?.error || MSG_PDF_FALHOU });
        return;
      }
      const blob = await r.blob();
      const arquivo = nomeDoAnexo(r.headers.get("content-disposition"), nomePadrao);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = arquivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setEstado({ tipo: "pronto", arquivo });
    } catch {
      setEstado({ tipo: "erro", msg: MSG_PDF_FALHOU });
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={baixar} disabled={estado.tipo === "gerando"} aria-busy={estado.tipo === "gerando"} className={className} data-testid={testId}>
        {estado.tipo === "gerando" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />} {rotulo}
      </button>
      <span role="status" aria-live="polite" data-testid={`${testId}-aviso`} className={`text-xs ${estado.tipo === "erro" ? "font-medium text-red-700" : "text-muted"}`}>
        {estado.tipo === "gerando" ? MSG_PDF_GERANDO : estado.tipo === "pronto" ? msgPdfBaixado(estado.arquivo) : estado.tipo === "erro" ? estado.msg : ""}
      </span>
    </span>
  );
}
