import { Home, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Modo do avatar — espelha o "mundo" ativo (proprietário/inquilino). */
export type AvatarMode = "owner" | "tenant";

/** Acento de cor + ícone por papel (coerente com a barra de modo). */
const MODE_STYLE: Record<
  AvatarMode,
  { ring: string; badge: string; icon: React.ComponentType<{ className?: string }> }
> = {
  owner: { ring: "ring-champagne", badge: "bg-champagne text-forest", icon: Home },
  tenant: { ring: "ring-blue-500", badge: "bg-blue-500 text-white", icon: Search },
};

/**
 * Avatar placeholder: iniciais sobre o gradiente de marca azul→verde.
 *
 * Com `mode`, ganha o acento do papel ativo (anel colorido + selo com ícone) —
 * usado no painel para reforçar visualmente "em qual mundo estou". A chave
 * `mode` muda na troca inquilino⇄proprietário, disparando a animação.
 */
export function Avatar({
  name,
  size = 40,
  mode,
  badgeRing = "ring-forest",
  className,
}: {
  name: string;
  size?: number;
  mode?: AvatarMode;
  /** Cor do anel de recorte do selo — combine com o fundo (padrão: forest). */
  badgeRing?: string;
  className?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

  const m = mode ? MODE_STYLE[mode] : null;
  const BadgeIcon = m?.icon;
  const badge = Math.round(size * 0.44);

  const face = (
    <span
      className={cn(
        "inline-grid h-full w-full place-items-center rounded-full bg-gradient-brand font-title font-bold text-white transition-[box-shadow] duration-300",
        m && cn("ring-2 ring-offset-2 ring-offset-forest", m.ring),
        className
      )}
      style={{ fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );

  if (!m) {
    return (
      <span className="inline-block shrink-0" style={{ width: size, height: size }}>
        {face}
      </span>
    );
  }

  return (
    <span
      key={mode}
      className="avatar-swap relative inline-block shrink-0"
      style={{ width: size, height: size }}
    >
      {face}
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full ring-2",
          m.badge,
          badgeRing
        )}
        style={{ width: badge, height: badge }}
        aria-hidden
      >
        {BadgeIcon && <BadgeIcon className="h-1/2 w-1/2" />}
      </span>
    </span>
  );
}
