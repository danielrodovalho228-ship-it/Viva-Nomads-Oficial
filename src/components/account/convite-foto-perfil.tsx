"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/dashboard/primitives";
import { buttonClasses } from "@/components/ui/button";
import { getMyAvatarUrl } from "@/lib/data/avatar-actions";
import { CONVITE_FOTO_CHAVE, CONVITE_FOTO_TEXTO, deveMostrarConviteFoto } from "@/lib/perfil/convite-foto";
import { EnviarFoto, FOTO_ATUALIZADA } from "@/components/account/foto-perfil";

/**
 * Cartão "Complete seu perfil" (foto). Opcional: some quando há foto e pode ser
 * dispensado ("Agora não"), voltando no máximo 1x a cada 7 dias. Nunca bloqueia nada.
 * CONTA-A: "Adicionar foto" abre o fluxo único da foto aqui mesmo (nunca mais uma âncora).
 */
export function ConviteFotoPerfil({ className }: { className?: string }) {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    let vivo = true;
    let dispensado: string | null = null;
    try {
      dispensado = localStorage.getItem(CONVITE_FOTO_CHAVE);
    } catch {
      /* navegador sem armazenamento: mostra */
    }
    getMyAvatarUrl()
      .then((r) => {
        if (vivo) setMostrar(deveMostrarConviteFoto({ temFoto: !!r.url, dispensadoEm: dispensado }));
      })
      .catch(() => {});
    const aoMudar = (e: Event) => (e as CustomEvent<{ url: string | null }>).detail?.url && setMostrar(false);
    window.addEventListener(FOTO_ATUALIZADA, aoMudar);
    return () => {
      vivo = false;
      window.removeEventListener(FOTO_ATUALIZADA, aoMudar);
    };
  }, []);

  if (!mostrar) return null;

  function agoraNao() {
    try {
      localStorage.setItem(CONVITE_FOTO_CHAVE, String(Date.now()));
    } catch {
      /* ignora */
    }
    setMostrar(false);
  }

  return (
    <Panel className={className} data-testid="convite-foto-perfil">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-title text-base font-semibold text-ink">Complete seu perfil</h2>
          <p className="mt-1 text-sm text-muted">{CONVITE_FOTO_TEXTO}.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <EnviarFoto temFoto={false} rotulo="Adicionar foto" testId="convite-foto-adicionar" />
          <button type="button" onClick={agoraNao} className={buttonClasses({ variant: "ghost" })} data-testid="convite-foto-agora-nao">
            Agora não
          </button>
        </div>
      </div>
    </Panel>
  );
}
