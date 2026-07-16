"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

/**
 * Botão de compartilhar — Web Share API no mobile (folha nativa do sistema:
 * WhatsApp, etc.); fallback para copiar o link na área de transferência.
 */
export function ShareButton({
  title,
  text,
  className,
}: {
  title: string;
  text?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function compartilhar() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    // Web Share API (mobile e navegadores compatíveis).
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: text ?? title, url });
        return;
      } catch {
        return; // usuário cancelou — não faz fallback
      }
    }
    // Fallback: copia o link.
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sem clipboard — ignora silenciosamente */
    }
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      aria-label="Compartilhar"
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full border border-sage-200 px-3.5 py-2 text-sm font-medium text-ink hover:border-sage"
      }
    >
      {copied ? <Check className="h-4 w-4 text-forest" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Link copiado" : "Compartilhar"}
    </button>
  );
}
