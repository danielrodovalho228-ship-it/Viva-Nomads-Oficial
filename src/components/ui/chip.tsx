import * as React from "react";
import { buttonClasses } from "@/components/ui/button";

/**
 * Chip de filtro (Prompt 40): pill com contorno; selecionado = fundo tinta e
 * texto branco. É um botão de alternar (`aria-pressed`): tocar de novo desliga.
 */
export function Chip({
  ativo,
  className,
  ...props
}: { ativo: boolean } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed">) {
  return <button type="button" aria-pressed={ativo} className={buttonClasses({ variant: "chip", className })} {...props} />;
}
