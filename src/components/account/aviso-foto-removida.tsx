"use client";

import { useEffect, useState } from "react";
import { EnviarFoto, FOTO_ATUALIZADA } from "@/components/account/foto-perfil";
import { minhaFotoRemovida } from "@/lib/data/fotos-perfil-actions";
import { ENVIAR_OUTRA_FOTO, REGRA_FOTO_PERFIL } from "@/lib/perfil/foto-revisao";

/**
 * FOTO-PERFIL-B (E13): o aviso dentro do app quando a equipe removeu a foto pela fila — o motivo da lista fechada e
 * "Enviar outra foto". Some sozinho quando a pessoa envia foto nova.
 */
export function AvisoFotoRemovida() {
  const [motivo, setMotivo] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    minhaFotoRemovida()
      .then((r) => vivo && setMotivo(r.motivo))
      .catch(() => undefined);
    const aoMudar = (e: Event) => {
      if ((e as CustomEvent<{ url: string | null }>).detail?.url) setMotivo(null);
    };
    window.addEventListener(FOTO_ATUALIZADA, aoMudar);
    return () => {
      vivo = false;
      window.removeEventListener(FOTO_ATUALIZADA, aoMudar);
    };
  }, []);
  if (!motivo) return null;
  return (
    <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink" data-testid="aviso-foto-removida">
      <p className="font-semibold">A equipe removeu a foto do seu perfil. Motivo: {motivo}.</p>
      <p className="mt-1">{REGRA_FOTO_PERFIL}</p>
      <div className="mt-3">
        <EnviarFoto temFoto={false} rotulo={ENVIAR_OUTRA_FOTO} testId="aviso-foto-enviar" />
      </div>
    </div>
  );
}
