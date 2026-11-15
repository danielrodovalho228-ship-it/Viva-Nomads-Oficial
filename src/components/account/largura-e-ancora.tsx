"use client";

import { useEffect } from "react";
import { COOKIE_TELA, COOKIE_VEIO_DA_CONTA, LARGURA_COMPUTADOR, telaDaLargura, voltaAoMenuDaConta } from "@/lib/conta/redirecionar-no-servidor";
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
 * Largura desatualizada: o proxy marca quem ele mandou de /dashboard/conta para cá (cookie de vida curta). Se a tela
 * for estreita, o cookie da largura estava errado: grava o certo e volta ao menu da Conta (E492).
 */
export function AncoraAntigaDaConta() {
  useEffect(() => {
    const veioDeConta = document.cookie.split("; ").includes(`${COOKIE_VEIO_DA_CONTA}=1`);
    // A marca vale uma vez: sem apagar, abrir o Perfil direto logo em seguida voltaria ao menu.
    if (veioDeConta) document.cookie = `${COOKIE_VEIO_DA_CONTA}=; path=/dashboard/conta; max-age=0`;
    const destino = destinoDaAncora(window.location.hash, window.location.search);
    if (destino) {
      if (!destino.startsWith("/dashboard/conta/perfil")) window.location.replace(destino);
      return;
    }
    const telaLarga = window.matchMedia(`(min-width: ${LARGURA_COMPUTADOR}px)`).matches;
    const menu = voltaAoMenuDaConta({ veioDeConta, telaLarga, search: window.location.search });
    if (!menu) return;
    const seguro = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_TELA}=estreita; path=/; max-age=31536000; SameSite=Lax${seguro}`;
    window.location.replace(menu);
  }, []);
  return null;
}
