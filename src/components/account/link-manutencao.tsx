"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { useViewMode } from "@/lib/roles";
import { papelDaBarra } from "@/lib/nav-mobile";
import { useParceiroAprovado, usePreferenciaParceiro } from "@/lib/use-papel-barra";
import { destinoManutencao } from "@/lib/conta/manutencao-papel";

/** E468: o papel ativo, pela MESMA regra do cabeçalho do painel (papelDaBarra). */
function usePapelDoCabecalho() {
  const user = useAuthStore((s) => s.user);
  const { mode } = useViewMode();
  const parceiroAprovado = useParceiroAprovado();
  const preferenciaParceiro = usePreferenciaParceiro();
  const pathname = usePathname();
  return papelDaBarra({ admin: user?.role === "admin", modo: mode === "owner" ? "owner" : "tenant", parceiroAprovado, preferenciaParceiro, pathname });
}

/** E468: o vazio do bloco "Atualizações de manutenção", com o texto e o destino do papel ativo. */
export function TextoManutencaoVazia() {
  const d = destinoManutencao(usePapelDoCabecalho());
  return (
    <p className="text-sm text-muted" data-testid="manutencao-vazia">
      {d.texto}{" "}
      <Link href={d.href} className="font-medium text-forest underline" data-testid="link-manutencao">
        {d.rotulo}
      </Link>
      .
    </p>
  );
}
