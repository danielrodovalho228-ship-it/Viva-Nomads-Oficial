"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Camera, Trash2, Check, ShieldCheck } from "lucide-react";
import { useAuthStore, DEMO_USER } from "@/lib/store";
import { useViewMode } from "@/lib/roles";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import {
  squareCrop,
  outputSize,
  validarArquivoAvatar,
  avatarPath,
  AVATARS_BUCKET,
  AVATAR_QUALITY,
} from "@/lib/avatar-image";
import { setMyAvatarPath, clearMyAvatar, getMyAvatarUrl } from "@/lib/data/avatar-actions";

/**
 * "Foto de perfil" na Conta (Fase 2). Canal 100% VOLUNTÁRIO e opcional — o
 * padrão é o avatar de iniciais. NUNCA reaproveita a selfie da verificação (CAF).
 *
 * Processamento no navegador ANTES de subir: recorte quadrado central + resize
 * (máx. 512px) + re-codificação em WebP via <canvas> — o que, de brinde, APAGA
 * todo o EXIF (inclusive geolocalização) do arquivo original. Sobe ao bucket
 * PRIVADO `avatars` na pasta do próprio usuário; o caminho vai para o perfil.
 *
 * A visibilidade (proprietário público / inquilino só após aceite) é decidida
 * no SERVIDOR quando a foto é EXIBIDA a terceiros — aqui é só o envio do dono.
 */
export function AvatarUploader() {
  const user = useAuthStore((s) => s.user) ?? DEMO_USER;
  const { mode } = useViewMode();
  const inputRef = useRef<HTMLInputElement>(null);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Carrega a foto atual (URL assinada da própria foto), se houver.
  useEffect(() => {
    let alive = true;
    getMyAvatarUrl()
      .then((r) => {
        if (alive) setPhotoUrl(r.url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    setError(null);
    setOkMsg(null);

    const invalid = validarArquivoAvatar({ type: file.type, size: file.size });
    if (invalid) {
      setError(invalid);
      return;
    }

    setBusy(true);
    try {
      const blob = await processarImagem(file);
      const localPreview = URL.createObjectURL(blob);

      const supabase = createClient();
      if (!supabase) {
        // Demo/sem Supabase: só mostra a prévia local (não persiste).
        setPhotoUrl(localPreview);
        setOkMsg("Prévia (modo demonstração — não salvo).");
        return;
      }

      const path = avatarPath(user.id);
      const { error: upErr } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, blob, { upsert: true, contentType: "image/webp", cacheControl: "0" });
      if (upErr) {
        setError("Não foi possível enviar a foto agora. Tente novamente.");
        return;
      }
      const res = await setMyAvatarPath(path);
      if (!res.ok) {
        setError("Foto enviada, mas não consegui salvar no seu perfil.");
        return;
      }
      // Recarrega a URL assinada oficial (não o objectURL local).
      const fresh = await getMyAvatarUrl();
      setPhotoUrl(fresh.url ?? localPreview);
      setOkMsg("Foto atualizada.");
    } catch {
      setError("Não foi possível processar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      await clearMyAvatar();
      setPhotoUrl(null);
      setOkMsg("Foto removida.");
    } catch {
      setError("Não foi possível remover agora.");
    } finally {
      setBusy(false);
    }
  }

  const isOwner = mode !== "tenant";

  return (
    <Panel title="Foto de perfil" className="mt-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="shrink-0">
          <Avatar name={user.fullName ?? user.email} size={88} photoUrl={photoUrl ?? undefined} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">
            Opcional. Sem foto, mostramos suas iniciais.{" "}
            {isOwner ? (
              <>Como proprietário, sua foto aparece <strong className="text-ink">no anúncio</strong> — o rosto gera confiança.</>
            ) : (
              <>Como inquilino, sua foto fica <strong className="text-ink">protegida</strong>: o proprietário só a vê <strong className="text-ink">depois de aceitar</strong> a conversa.</>
            )}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPick}
            />
            <Button onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {photoUrl ? "Trocar foto" : "Enviar foto"}
            </Button>
            {photoUrl && (
              <Button variant="outline" onClick={onRemove} disabled={busy} className="border-red-200 text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> Remover
              </Button>
            )}
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {okMsg && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-forest">
              <Check className="h-4 w-4" /> {okMsg}
            </p>
          )}

          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
            Recortamos, reduzimos e removemos os metadados (inclusive localização) antes de guardar.
            Esta foto é separada da verificação de identidade.
          </p>
        </div>
      </div>
    </Panel>
  );
}

/**
 * Recorta (quadrado central), redimensiona (máx. 512px) e re-codifica em WebP.
 * O re-encode via canvas DESCARTA o EXIF do original (privacidade). Geometria
 * calculada por `squareCrop`/`outputSize` (puras, testadas).
 */
async function processarImagem(file: File): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  const crop = squareCrop(bitmap.width, bitmap.height);
  const out = outputSize(crop.size);

  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-2d-context");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, crop.sx, crop.sy, crop.size, crop.size, 0, 0, out, out);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", AVATAR_QUALITY)
  );
  if (!blob) throw new Error("encode-failed");
  return blob;
}

/** Carrega o arquivo como bitmap (createImageBitmap com fallback a <img>). */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* cai para o fallback */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("img-load"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
