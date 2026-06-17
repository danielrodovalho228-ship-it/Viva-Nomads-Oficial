import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Espaço marcado para foto real (sem gerar imagens). Mantém a proporção
 * do layout e indica claramente onde a imagem entra.
 */
export function PhotoPlaceholder({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 bg-sage-100 text-sage",
        className
      )}
    >
      <ImageIcon className="h-6 w-6" aria-hidden />
      {label && (
        <span className="px-3 text-center text-xs font-medium text-forest/70">{label}</span>
      )}
    </div>
  );
}
