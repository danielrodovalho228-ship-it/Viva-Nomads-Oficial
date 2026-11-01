"use client";

import { useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * E247 (resíduo, varredura 01/11): o seletor de arquivo do site — botão de contorno em português e o nome do arquivo
 * escolhido ao lado. O campo nativo ("Choose File / No file chosen" num navegador em inglês) fica escondido (sr-only),
 * mas continua no formulário (name, required, accept) e acessível pelo rótulo.
 */
export const CLASSE_SELETOR_ARQUIVO =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-sage-200 bg-white px-4 text-sm font-medium text-ink hover:bg-sage-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-forest";

export function SeletorArquivo({
  rotulo = "Escolher arquivo",
  ariaLabel,
  testid,
  className,
  onChange,
  multiple,
  ...resto
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & { rotulo?: string; ariaLabel?: string; testid?: string; className?: string }) {
  const [nomes, setNomes] = useState<string[]>([]);
  return (
    <span className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1", className)} data-seletor-arquivo>
      <label className={CLASSE_SELETOR_ARQUIVO}>
        <Upload className="h-4 w-4" aria-hidden /> {rotulo}
        <input
          {...resto}
          type="file"
          multiple={multiple}
          aria-label={ariaLabel ?? rotulo}
          className="sr-only"
          data-testid={testid}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setNomes(Array.from(e.target.files ?? []).map((f) => f.name));
            onChange?.(e);
          }}
        />
      </label>
      <span className="min-w-0 truncate text-sm text-muted" aria-live="polite">
        {nomes.length === 0 ? "Nenhum arquivo escolhido" : nomes.length === 1 ? nomes[0] : `${nomes.length} arquivos escolhidos`}
      </span>
    </span>
  );
}
