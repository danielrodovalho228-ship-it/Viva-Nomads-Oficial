"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store";
import { avatarPath, AVATARS_BUCKET, validarArquivoAvatar } from "@/lib/avatar-image";
import { getMyAvatarUrl, setMyAvatarPath } from "@/lib/data/avatar-actions";
import { CONVITE_FOTO_CANDIDATURA_TEXTO } from "@/lib/perfil/convite-foto";
import { processarImagem } from "@/components/account/avatar-uploader";

/**
 * Convite opcional no passo "Confirmar candidatura" (ordem 504d9679, peça 2) e na revisão do novo anúncio (peça 3, via `texto`). Nunca bloqueia o
 * envio: some quando já há foto, e qualquer erro só mostra uma frase. Reaproveita o mesmo
 * processamento da Conta (recorte, WebP, sem EXIF) e o bucket privado.
 */
export function ConviteFotoCandidatura({
  texto = CONVITE_FOTO_CANDIDATURA_TEXTO,
  testId = "convite-foto-candidatura",
}: {
  texto?: string;
  testId?: string;
} = {}) {
  const usuario = useAuthStore((s) => s.user);
  const inputRef = useRef<HTMLInputElement>(null);
  const [temFoto, setTemFoto] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario?.id) return;
    let vivo = true;
    getMyAvatarUrl()
      .then((r) => {
        if (vivo) setTemFoto(!!r.url);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [usuario?.id]);

  if (!usuario?.id || temFoto === null) return null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !usuario) return;
    setErro(null);
    const invalido = validarArquivoAvatar({ type: file.type, size: file.size });
    if (invalido) {
      setErro(invalido);
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      if (!supabase) return;
      const blob = await processarImagem(file);
      const path = avatarPath(usuario.id);
      const { error } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, blob, { upsert: true, contentType: "image/webp", cacheControl: "0" });
      if (error) throw error;
      const res = await setMyAvatarPath(path);
      if (!res.ok) throw new Error("perfil");
      setTemFoto(true);
    } catch {
      setErro("Não foi possível enviar a foto agora. Você pode seguir sem ela.");
    } finally {
      setBusy(false);
    }
  }

  if (temFoto) return null;

  return (
    <div className="mt-3 rounded-lg border border-line px-3 py-3 text-sm" data-testid={testId}>
      <p className="text-muted">{texto}. <span className="text-xs">(opcional)</span></p>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} data-testid={`${testId}-input`} />
      <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Adicionar foto
      </Button>
      {erro && <p role="status" className="mt-2 text-xs text-red-600">{erro}</p>}
    </div>
  );
}
