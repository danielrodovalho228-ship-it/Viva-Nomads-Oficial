"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ContaMenu } from "@/components/account/conta-menu";
import { CascaConta } from "@/components/account/casca-conta";
import { PerfilTela } from "@/components/account/perfil-tela";
import { destinoDaAncora } from "@/lib/conta/secoes";

/**
 * Conta (A1, sequência-mestre CONTA-A, mockups perfil-01..08 aprovados em 23/10).
 * - Computador (≥ 1024 px): a tela Perfil (perfil-01) dentro da casca da Conta, com o menu lateral das oito seções;
 *   cada seção é a sua própria tela em /dashboard/conta/<seção>.
 * - Celular (site e app): o menu da Conta; cada seção abre a sua tela com "‹ Conta".
 * Um H1 visível por largura: "Conta" no menu do celular; "Perfil" no computador.
 */
export default function AccountPage() {
  const router = useRouter();
  // O Perfil desta página só existe no computador. No celular ele NÃO é montado: escondido por CSS, ele disparava as
  // ações do servidor e a resposta, chegando depois do toque numa seção, devolvia a URL para /dashboard/conta.
  const [computador, setComputador] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const ver = () => setComputador(mq.matches);
    ver();
    mq.addEventListener("change", ver);
    return () => mq.removeEventListener("change", ver);
  }, []);
  // Links antigos da página longa (/dashboard/conta#confianca, #documento…): cada âncora vai para a sua tela.
  useEffect(() => {
    const destino = destinoDaAncora(window.location.hash, window.location.search);
    if (destino) router.replace(destino);
  }, [router]);
  return (
    <>
      <div className="lg:hidden">
        <ContaMenu />
      </div>
      {computador && (
        <div className="hidden lg:block" data-so-computador>
          <CascaConta ativo="perfil" topoDireita>
            <PerfilTela />
          </CascaConta>
        </div>
      )}
    </>
  );
}
