import { cn } from "@/lib/utils";

/**
 * Botão só-ícone ACESSÍVEL. O `label` é obrigatório no tipo — vira `aria-label`
 * e `title`, garantindo que o leitor de tela nunca leia apenas "botão".
 * Use sempre que um botão não tiver texto visível (fechar, setas, favoritar…).
 */
export function IconButton({
  label,
  icon: Icon,
  className,
  iconClassName,
  ...props
}: {
  /** Descrição da ação (obrigatória) — vira aria-label/title. */
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn("grid place-items-center rounded-full transition-colors", className)}
      {...props}
    >
      <Icon className={cn("h-5 w-5", iconClassName)} />
    </button>
  );
}
