import Link from "next/link";
import { cn } from "@/lib/utils";

/** Logo: losango verde floresta + wordmark "Viva Nomads". */
export function Logo({
  href = "/home",
  light = false,
  className,
}: {
  href?: string;
  light?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="grid h-8 w-8 place-items-center rounded-md bg-forest"
        aria-hidden
      >
        <span className="h-3.5 w-3.5 rotate-45 rounded-[3px] bg-champagne" />
      </span>
      <span
        className={cn(
          "font-title text-lg font-extrabold tracking-tight",
          light ? "text-white" : "text-forest"
        )}
      >
        Viva Nomads
      </span>
    </Link>
  );
}
