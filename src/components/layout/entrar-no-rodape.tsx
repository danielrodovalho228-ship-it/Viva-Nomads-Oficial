"use client";

import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { useMontado } from "@/lib/use-client-state";

/**
 * E467 (PC11): "Entrar ou cadastrar" do rodapé só para quem NÃO está logado — a mesma regra do cabeçalho (o servidor
 * desenha o estado deslogado; depois de montar, com usuário, o link sai). Mesmo visual dos outros links do rodapé.
 */
export function EntrarNoRodape() {
  const user = useAuthStore((s) => s.user);
  const logado = useMontado() && !!user;
  if (logado) return null;
  return (
    <li>
      <Link href="/auth" className="inline-flex min-h-11 items-center text-white/60 transition-colors hover:text-white md:inline md:min-h-0" data-testid="rodape-entrar">
        Entrar ou cadastrar
      </Link>
    </li>
  );
}
