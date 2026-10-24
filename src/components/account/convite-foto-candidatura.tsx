"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { getMyAvatarUrl } from "@/lib/data/avatar-actions";
import { CONVITE_FOTO_CANDIDATURA_TEXTO } from "@/lib/perfil/convite-foto";
import { EnviarFoto, FOTO_ATUALIZADA } from "@/components/account/foto-perfil";

/**
 * Convite opcional no passo "Confirmar candidatura" (ordem 504d9679, peça 2) e na revisão do novo anúncio (peça 3, via `texto`). Nunca bloqueia o
 * envio: some quando já há foto. CONTA-A: "Adicionar foto" abre o fluxo ÚNICO da foto (recorte, prévia, salvar).
 */
export function ConviteFotoCandidatura({
  texto = CONVITE_FOTO_CANDIDATURA_TEXTO,
  testId = "convite-foto-candidatura",
}: {
  texto?: string;
  testId?: string;
} = {}) {
  const usuario = useAuthStore((s) => s.user);
  const [temFoto, setTemFoto] = useState<boolean | null>(null);

  useEffect(() => {
    if (!usuario?.id) return;
    let vivo = true;
    getMyAvatarUrl()
      .then((r) => {
        if (vivo) setTemFoto(!!r.url);
      })
      .catch(() => {});
    const aoMudar = (e: Event) => setTemFoto(!!(e as CustomEvent<{ url: string | null }>).detail?.url);
    window.addEventListener(FOTO_ATUALIZADA, aoMudar);
    return () => {
      vivo = false;
      window.removeEventListener(FOTO_ATUALIZADA, aoMudar);
    };
  }, [usuario?.id]);

  if (!usuario?.id || temFoto === null || temFoto) return null;

  return (
    <div className="mt-3 rounded-lg border border-line px-3 py-3 text-sm" data-testid={testId}>
      <p className="text-muted">
        {texto}. <span className="text-xs">(opcional)</span>
      </p>
      <EnviarFoto temFoto={false} rotulo="Adicionar foto" className="mt-2" testId={`${testId}-botao`} />
    </div>
  );
}
