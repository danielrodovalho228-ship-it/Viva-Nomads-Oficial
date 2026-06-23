"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Campo de senha com botão "olho" para mostrar/ocultar. Flexível: aceita um
 * ícone à esquerda (ex.: cadeado) e classes do contêiner/input para combinar
 * com cada tela. O alternador é acessível (aria-label) e não submete o form.
 */
export function PasswordInput({
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  leadingIcon: Leading,
  className,
  inputClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  leadingIcon?: React.ComponentType<{ className?: string }>;
  className?: string;
  inputClassName?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={cn("relative flex items-center gap-3", className)}>
      {Leading && <Leading className="h-4 w-4 shrink-0 text-sage" />}
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        className={cn("w-full bg-transparent outline-none placeholder:text-muted", inputClassName)}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        title={show ? "Ocultar senha" : "Mostrar senha"}
        className="shrink-0 text-muted transition-colors hover:text-ink"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
