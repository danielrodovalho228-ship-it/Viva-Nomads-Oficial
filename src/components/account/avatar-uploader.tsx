"use client";

import { useState } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { useAuthStore, DEMO_USER } from "@/lib/store";
import { useViewMode } from "@/lib/roles";
import { displayName } from "@/lib/display-name";
import { Panel } from "@/components/dashboard/primitives";
import { Avatar } from "@/components/ui/avatar";
import { clearMyAvatar } from "@/lib/data/avatar-actions";
import { EnviarFoto, avisarFotoAtualizada, useMinhaFoto } from "@/components/account/foto-perfil";

/**
 * "Foto de perfil" na subtela do app. Canal 100% VOLUNTÁRIO e opcional — o padrão é o avatar de iniciais (ou a
 * silhueta, sem nome). NUNCA reaproveita a selfie da verificação (CAF). CONTA-A: usa o fluxo ÚNICO da foto
 * (foto-perfil.tsx: recorte, prévia, 512 px, WebP sem EXIF), o mesmo do topo da Conta e dos convites.
 * A visibilidade (proprietário público / inquilino só após aceite) é decidida no SERVIDOR quando a foto é exibida.
 */
export function AvatarUploader() {
  const user = useAuthStore((s) => s.user) ?? DEMO_USER;
  const { mode } = useViewMode();
  const foto = useMinhaFoto();
  const [msg, setMsg] = useState<string | null>(null);
  const isOwner = mode !== "tenant";

  async function remover() {
    setMsg(null);
    try {
      await clearMyAvatar();
      avisarFotoAtualizada(null);
      setMsg("Foto removida");
    } catch {
      setMsg("Não foi possível remover agora. Tente de novo.");
    }
  }

  return (
    <Panel title="Foto de perfil" className="mt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="shrink-0">
          {/* Iniciais pela fonte única — NUNCA o e-mail (item 1 do fechamento). */}
          <Avatar name={displayName(user) ?? ""} size={88} photoUrl={foto.url ?? undefined} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">
            Opcional.{" "}
            {isOwner ? (
              <>Como proprietário, sua foto aparece no anúncio: o rosto gera confiança.</>
            ) : (
              <>Como inquilino, sua foto fica protegida: o proprietário só a vê depois de aceitar a conversa.</>
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <EnviarFoto temFoto={!!foto.url} testId="subtela-foto" />
            {foto.url && (
              <button type="button" onClick={remover} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-red-700 underline underline-offset-2">
                <Trash2 className="h-4 w-4" aria-hidden /> Remover
              </button>
            )}
          </div>
          {msg && (
            <p role="status" className="mt-2 text-sm text-forest">
              {msg}
            </p>
          )}
          <p className="mt-3 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-1 h-3.5 w-3.5 shrink-0 text-sage" aria-hidden />
            Recortamos, reduzimos e removemos os metadados (inclusive localização) antes de guardar. Esta foto é separada da verificação de identidade.
          </p>
        </div>
      </div>
    </Panel>
  );
}
