"use client";

import { useEffect, useRef, useState } from "react";
import { formatarReaisDigitando, lerReais, reaisParaCampo } from "@/lib/reais";
import { cn } from "@/lib/utils";

/**
 * Campo de dinheiro no formato brasileiro (complemento do prompt 27, parte B): formata enquanto a pessoa digita
 * ("3300" → "3.300") e entrega o número pela fonte única `lerReais`. Texto (não type="number"): o campo numérico do
 * navegador lia "3.300" como 3,3.
 */
export function CampoReais({
  value,
  onChange,
  centavos = false,
  id,
  name,
  placeholder,
  className,
  ariaLabel,
  ariaDescribedBy,
  disabled,
  testid,
  semPrefixo,
}: {
  value: number | null | undefined;
  onChange: (valor: number | null) => void;
  /** Aceita vírgula e até 2 casas. Padrão: só reais inteiros. */
  centavos?: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  disabled?: boolean;
  testid?: string;
  /** Não desenha o "R$" (o rótulo ou um prefixo de fora já mostra). */
  semPrefixo?: boolean;
}) {
  const [texto, setTexto] = useState(() => reaisParaCampo(value, centavos));
  const [erro, setErro] = useState<string | null>(null);
  const ultimo = useRef<number | null | undefined>(value);
  // Valor mudado por fora (ex.: "usar sugestão"): o texto acompanha. O que a própria digitação mandou não reescreve.
  useEffect(() => {
    if (value !== ultimo.current) {
      ultimo.current = value;
      setTexto(reaisParaCampo(value, centavos));
      setErro(null);
    }
  }, [value, centavos]);
  return (
    <span className="block">
      <span className={cn("flex items-center", !semPrefixo && "gap-1")}>
        {!semPrefixo && <span className="text-sm text-muted">R$</span>}
        <input
          type="text"
          inputMode={centavos ? "decimal" : "numeric"}
          autoComplete="off"
          id={id}
          name={name}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={erro ? true : undefined}
          disabled={disabled}
          data-testid={testid}
          className={className ?? "input"}
          value={texto}
          onChange={(e) => {
            const formatado = formatarReaisDigitando(e.target.value, centavos);
            setTexto(formatado);
            const r = lerReais(formatado);
            if (!r.ok) {
              setErro(r.erro);
              return;
            }
            setErro(null);
            ultimo.current = r.valor;
            onChange(r.valor);
          }}
        />
      </span>
      {erro && (
        <span className="mt-1 block text-xs text-red-700" role="alert">
          {erro}
        </span>
      )}
    </span>
  );
}
