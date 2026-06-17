import { cn } from "@/lib/utils";

/** Avatar placeholder: iniciais sobre o gradiente de marca azul→verde. */
export function Avatar({
  name,
  size = 40,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full bg-gradient-brand font-title font-bold text-white",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}
