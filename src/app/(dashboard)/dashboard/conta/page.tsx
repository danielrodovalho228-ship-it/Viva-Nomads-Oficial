"use client";

import { useEffect } from "react";
import { ContaMenu } from "@/components/account/conta-menu";
import { destinoDaAncora, destinoDaContaNoComputador } from "@/lib/conta/secoes";

/**
 * Conta (A1, sequência-mestre CONTA-A, mockups perfil-01..08 aprovados em 23/10).
 * - Celular (site e app): o menu da Conta; cada seção abre a sua tela com "‹ Conta".
 * - Computador (≥ 1024 px): E492 (+E552) — a Conta não tem mais uma segunda cópia da tela de Perfil. /dashboard/conta
 *   leva a /dashboard/conta/perfil (um endereço só para o Perfil); cada seção segue em /dashboard/conta/<seção>.
 */
export default function AccountPage() {
  // Links antigos da página longa (/dashboard/conta#confianca, #documento…): cada âncora vai para a sua tela.
  // Troca de documento (não pelo roteador): as Server Actions entram numa fila com a navegação do roteador (docs do
  // Next, "Server Actions are queued"), e a resposta de uma leitura do painel devolvia a URL para /dashboard/conta.
  useEffect(() => {
    const destino = destinoDaAncora(window.location.hash, window.location.search);
    const computador = window.matchMedia("(min-width: 1024px)").matches;
    if (computador) window.location.replace(destinoDaContaNoComputador(destino));
    else if (destino) window.location.replace(destino);
  }, []);
  return (
    <div className="lg:hidden">
      <ContaMenu />
    </div>
  );
}
