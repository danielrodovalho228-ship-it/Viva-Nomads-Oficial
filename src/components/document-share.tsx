"use client";

import { useState } from "react";
import { Download, MessageCircle, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Compartilhamento profissional de orçamento/contrato (Atualização 17).
 * - Baixar PDF: aciona a impressão (Salvar como PDF) da página formatada.
 * - WhatsApp: abre o app com um resumo + número do documento.
 * - Copiar link: copia o link direto do documento.
 */
export function DocumentShare({
  docNumber,
  shareUrl,
  summary,
}: {
  docNumber: string;
  shareUrl: string;
  summary: string;
}) {
  const [copied, setCopied] = useState(false);

  function downloadPdf() {
    if (typeof window !== "undefined") window.print();
  }

  function shareWhatsApp() {
    const text = `${summary}\n\nDocumento ${docNumber} · Viva Nomads\n${shareUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    try {
      await navigator.clipboard?.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível — ignora */
    }
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button variant="primary" size="sm" onClick={downloadPdf}>
        <Download className="h-4 w-4" /> Baixar PDF
      </Button>
      <Button variant="outline" size="sm" onClick={shareWhatsApp}>
        <MessageCircle className="h-4 w-4" /> WhatsApp
      </Button>
      <Button variant="outline" size="sm" onClick={copyLink}>
        {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        {copied ? "Copiado!" : "Copiar link"}
      </Button>
    </div>
  );
}
