"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { buttonClasses } from "@/components/ui/button";
import { getMyAvatarUrl } from "@/lib/data/avatar-actions";
import { CONVITE_FOTO_CHAVE, CONVITE_FOTO_TEXTO, deveMostrarConviteFoto } from "@/lib/perfil/convite-foto";

/**
 * Cartão "Complete seu perfil" (foto). Opcional: some quando há foto e pode ser
 * dispensado ("Agora não"), voltando no máximo 1x a cada 7 dias. Nunca bloqueia nada.
 */
export function ConviteFotoPerfil({ href = "/dashboard/conta#perfil-publico", className }: { href?: string; className?: string }) {
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
    return () => {
      vivo = false;
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
        <div className="flex shrink-0 gap-2">
          <Link href={href} className={buttonClasses({ variant: "primary" })} data-testid="convite-foto-adicionar">
            <Camera className="h-4 w-4" /> Adicionar foto
          </Link>
          <button type="button" onClick={agoraNao} className={buttonClasses({ variant: "ghost" })} data-testid="convite-foto-agora-nao">
            Agora não
          </button>
        </div>
      </div>
    </Panel>
  );
}
