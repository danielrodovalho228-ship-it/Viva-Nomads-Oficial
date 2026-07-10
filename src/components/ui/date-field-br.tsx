"use client";

import { useEffect, useState } from "react";

/**
 * Campo de data em pt-BR (dd/mm/aaaa), com máscara — independente do locale do
 * navegador (o `<input type="date">` nativo mostra mm/dd/yyyy em navegadores
 * en-US). Guarda/emite o valor em ISO (yyyy-mm-dd), como o resto do app espera.
 */
function isoParaBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function brParaIso(br: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dd = +d;
  const mm = +mo;
  const yy = +y;
  // Valida a data de fato (rejeita 31/02 etc.).
  const date = new Date(yy, mm - 1, dd);
  if (date.getFullYear() !== yy || date.getMonth() !== mm - 1 || date.getDate() !== dd) return null;
  return `${y}-${mo}-${d}`;
}

function mascarar(input: string): string {
  const digitos = input.replace(/\D/g, "").slice(0, 8);
  const p = [digitos.slice(0, 2), digitos.slice(2, 4), digitos.slice(4, 8)].filter(Boolean);
  return p.join("/");
}

export function DateFieldBR({
  value,
  onChange,
  id,
  required,
  className,
}: {
  /** Valor em ISO (yyyy-mm-dd) ou "". */
  value: string;
  /** Emite ISO quando a data está completa e válida; "" enquanto incompleta. */
  onChange: (iso: string) => void;
  id?: string;
  required?: boolean;
  className?: string;
}) {
  const [texto, setTexto] = useState(isoParaBr(value));

  // Reflete mudanças externas do valor (ex.: reset do form).
  useEffect(() => {
    setTexto(isoParaBr(value));
  }, [value]);

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/aaaa"
      required={required}
      value={texto}
      onChange={(e) => {
        const m = mascarar(e.target.value);
        setTexto(m);
        onChange(brParaIso(m) ?? "");
      }}
      className={className}
    />
  );
}
