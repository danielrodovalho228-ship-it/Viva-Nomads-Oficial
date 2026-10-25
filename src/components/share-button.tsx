"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

/**
 * Botão de compartilhar — Web Share API no mobile (folha nativa do sistema:
 * WhatsApp, etc.); fallback para copiar o link na área de transferência.
 * `icone` (Prompt 41): só o ícone, redondo, como o coração (compartilhar nunca é botão com texto).
 */
export function ShareButton({
  title,
  text,
  className,
  icone = false,
}: {
  title: string;
  text?: string;
  className?: string;
  icone?: boolean;
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

  if (icone) {
    return (
      <button
        type="button"
        onClick={compartilhar}
        aria-label={copied ? "Link copiado" : "Compartilhar"}
        data-testid="compartilhar"
        className={
          className ??
          "grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
        }
      >
        {copied ? <Check className="h-5 w-5 text-forest" aria-hidden /> : <Share2 className="h-5 w-5" aria-hidden />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      aria-label="Compartilhar"
      className={
        className ??
        "inline-flex items-center gap-2 rounded-full border border-sage-200 px-4 py-2 text-sm font-medium text-ink hover:border-sage"
      }
    >
      {copied ? <Check className="h-4 w-4 text-forest" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Link copiado" : "Compartilhar"}
    </button>
  );
}
