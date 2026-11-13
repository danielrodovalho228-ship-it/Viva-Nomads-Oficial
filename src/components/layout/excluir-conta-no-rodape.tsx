"use client";

import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { useMontado } from "@/lib/use-client-state";
import { ROTULO_EXCLUIR_CONTA, destinoExcluirConta } from "@/lib/conta/excluir-conta";

/**
 * E840: "Excluir conta" do rodapé com o destino pelo contexto — deslogado vai à página pública (/excluir-conta), logado
 * vai à tela da conta. Mesma leitura de sessão do "Entrar ou cadastrar" (E467): o servidor desenha o estado deslogado.
 */
export function ExcluirContaNoRodape() {
  const user = useAuthStore((s) => s.user);
  const logado = useMontado() && !!user;
  return (
    <li>
      <Link href={destinoExcluirConta(logado)} className="inline-flex min-h-11 items-center text-white/60 transition-colors hover:text-white md:inline md:min-h-0" data-testid="rodape-excluir-conta">
        {ROTULO_EXCLUIR_CONTA}
      </Link>
    </li>
  );
}
