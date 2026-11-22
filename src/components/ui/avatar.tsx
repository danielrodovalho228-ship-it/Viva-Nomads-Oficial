import { Home, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { corAvatar, rostoDoAvatar } from "@/lib/avatar";
import { FotoDoAvatar } from "@/components/ui/foto-do-avatar";

/** E788: a 28 px a inicial caía em ~11 px e a maiúscula "C" parecia um "c" minúsculo; nunca abaixo de 13 px. */
export const TAMANHO_MINIMO_INICIAL = 13;

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
  photoUrl,
  badgeRing = "ring-forest",
  className,
}: {
  name: string;
  size?: number;
  mode?: AvatarMode;
  /**
   * URL da foto — só passe quando o CHAMADOR tem DIREITO a ela (a rota da API
   * aplica `podeVerAvatar`). Ausente = iniciais (padrão). A foto do inquilino
   * chega aqui apenas quando a API a emite (relação em estado aceito).
   */
  photoUrl?: string;
  /** Cor do anel de recorte do selo — combine com o fundo (padrão: forest). */
  badgeRing?: string;
  className?: string;
}) {
  // CONTA-A: sem nome e sem foto, a silhueta neutra no círculo da casa — nunca "?".
  const rosto = rostoDoAvatar(name);

  const m = mode ? MODE_STYLE[mode] : null;
  const BadgeIcon = m?.icon;
  const badge = Math.round(size * 0.44);

  // E698: as iniciais (ou a silhueta) são SEMPRE a base; a foto entra por cima, com fade, quando carregar.
  const anel = m && cn("ring-2 ring-offset-2 ring-offset-forest", m.ring);
  const face = (
    <span className="relative inline-block h-full w-full">
      <span
        className={cn(
          "inline-grid h-full w-full place-items-center rounded-full uppercase font-title font-semibold text-white transition-[box-shadow] duration-300",
          anel,
          className
        )}
        style={{ fontSize: Math.max(size * 0.4, TAMANHO_MINIMO_INICIAL), backgroundColor: rosto.tipo === "silhueta" ? "var(--color-forest)" : corAvatar(name) }}
        data-rosto={rosto.tipo}
        aria-hidden
      >
        {rosto.tipo === "silhueta" ? <UserRound className="h-3/5 w-3/5" strokeWidth={1.75} /> : rosto.texto}
      </span>
      {photoUrl && <FotoDoAvatar key={photoUrl} src={photoUrl} className={cn(anel, className)} />}
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
