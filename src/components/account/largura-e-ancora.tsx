"use client";

import { useEffect } from "react";
import { COOKIE_TELA, LARGURA_COMPUTADOR, telaDaLargura } from "@/lib/conta/redirecionar-no-servidor";
import { destinoDaAncora } from "@/lib/conta/secoes";

/**
 * E798: grava a largura da tela deste aparelho (cookie, 1 ano) para o proxy saber, já no servidor, se /dashboard/conta
 * vai ao Perfil (computador) ou é o menu da Conta (celular). Só em useEffect (nada no 1º render).
 */
export function GravarLarguraDaTela() {
  useEffect(() => {
    const m = window.matchMedia(`(min-width: ${LARGURA_COMPUTADOR}px)`);
    const gravar = () => {
      const tela = telaDaLargura(m.matches ? LARGURA_COMPUTADOR : 0);
      if (!document.cookie.split("; ").includes(`${COOKIE_TELA}=${tela}`)) {
        const seguro = location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `${COOKIE_TELA}=${tela}; path=/; max-age=31536000; SameSite=Lax${seguro}`;
      }
    };
    gravar();
    m.addEventListener("change", gravar);
    return () => m.removeEventListener("change", gravar);
  }, []);
  return null;
}

/**
 * E798: com o redirecionamento no servidor, /dashboard/conta#documento chega ao Perfil com a âncora (o navegador a
 * mantém). Aqui ela vai para a seção certa, como a página da Conta fazia antes (destinoDaAncora). Âncora do próprio
 * Perfil (perfil-publico, pets) fica onde está.
 */
export function AncoraAntigaDaConta() {
  useEffect(() => {
    const destino = destinoDaAncora(window.location.hash, window.location.search);
    if (destino && !destino.startsWith("/dashboard/conta/perfil")) window.location.replace(destino);
  }, []);
  return null;
}
