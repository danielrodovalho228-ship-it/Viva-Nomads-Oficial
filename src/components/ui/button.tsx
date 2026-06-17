import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "outline" | "ghost" | "night" | "gold";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  // Azul de marca
  primary: "bg-blue-500 text-white hover:bg-blue-700",
  // Verde-limão (acento/CTA) com texto escuro — contraste AA
  accent: "bg-green-500 text-night hover:bg-green-300",
  gold: "bg-green-500 text-night hover:bg-green-300", // alias compat.
  outline: "border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white",
  ghost: "text-blue-500 hover:bg-blue-50",
  night: "bg-night text-white hover:bg-night/90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.98]";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  ...props
}: CommonProps & { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...props} />
  );
}
