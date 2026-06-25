"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Campo de senha com botão "olho" para ESPIAR a senha. Segurança: a senha só
 * fica visível ENQUANTO o olho está pressionado (segure para ver, solte e
 * volta a esconder) — nunca fica exposta na tela. Acessível e não submete o
 * form. Aceita ícone à esquerda e classes para combinar com cada tela.
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
        onMouseDown={() => setShow(true)}
        onMouseUp={() => setShow(false)}
        onMouseLeave={() => setShow(false)}
        onTouchStart={() => setShow(true)}
        onTouchEnd={() => setShow(false)}
        onTouchCancel={() => setShow(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setShow(true);
          }
        }}
        onKeyUp={() => setShow(false)}
        onBlur={() => setShow(false)}
        aria-label="Segure para ver a senha"
        title="Segure para ver a senha"
        className="shrink-0 text-muted transition-colors hover:text-ink"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
