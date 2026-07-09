"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AVATARS_BUCKET } from "@/lib/supabase/admin";
import { podeVerAvatar } from "@/lib/avatar";
import {
  signAvatarPath,
  relacaoAceitaEntreServidor,
  getAvatarPath,
} from "@/lib/data/avatar-url";

type UrlResult = { url: string | null };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Persiste o caminho da foto (após o upload no client) no perfil do próprio
 * usuário. RLS garante que só o dono atualiza a própria linha. No-op em demo.
 */
export async function setMyAvatarPath(path: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { ok: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: path, avatar_atualizado_em: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { ok: false };
  revalidatePath("/dashboard/conta");
  return { ok: true };
}

/** Remove a foto: apaga o arquivo e zera o caminho no perfil. */
export async function clearMyAvatar(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { ok: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const path = await getAvatarPath(user.id);
  if (path) {
    await supabase.storage.from(AVATARS_BUCKET).remove([path]);
  }
  await supabase
    .from("profiles")
    .update({ avatar_url: null, avatar_atualizado_em: new Date().toISOString() })
    .eq("id", user.id);
  revalidatePath("/dashboard/conta");
  return { ok: true };
}

/** URL assinada da MINHA própria foto (para o painel/topo). null se não há. */
export async function getMyAvatarUrl(): Promise<UrlResult> {
  const supabase = await createClient();
  if (!supabase) return { url: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { url: null };
  // O dono lê o próprio arquivo pela RLS — mas assinamos via admin para não
  // depender de a policy de leitura estar exatamente assim; é a MINHA foto.
  const path = await getAvatarPath(user.id);
  return { url: await signAvatarPath(path) };
}

/**
 * URL assinada da foto de OUTRA pessoa, aplicando `podeVerAvatar`.
 *  - proprietário (dono do imóvel em contexto): foto PÚBLICA;
 *  - inquilino: só com relação ACEITA entre nós (contrato ou pedido aceito);
 *  - eu mesmo / admin: sempre.
 * FAIL-CLOSED: sem direito, sem service role, ou erro → { url: null } (iniciais).
 */
export async function getAvatarUrl(params: {
  targetId: string;
  /** Imóvel do contexto: se o alvo é o dono dele, a foto é pública. */
  propertyId?: string;
}): Promise<UrlResult> {
  const { targetId, propertyId } = params;
  if (!targetId || !UUID_RE.test(targetId)) return { url: null };

  const supabase = await createClient();
  if (!supabase) return { url: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const viewerId = user?.id ?? "";
  const targetPath = await getAvatarPath(targetId);
  if (!targetPath) return { url: null };

  // Eu mesmo.
  if (viewerId && viewerId === targetId) {
    return { url: await signAvatarPath(targetPath) };
  }

  // Admin (moderação).
  let viewerIsAdmin = false;
  if (viewerId) {
    const { data: isAdm } = await supabase.rpc("is_admin");
    viewerIsAdmin = isAdm === true;
  }

  // O alvo é o PROPRIETÁRIO do imóvel em contexto? → foto pública.
  let targetPapel: "owner" | "tenant" = "tenant";
  if (propertyId && UUID_RE.test(propertyId)) {
    const { data: prop } = await supabase
      .from("properties")
      .select("owner_id")
      .eq("id", propertyId)
      .maybeSingle();
    if (prop?.owner_id === targetId) targetPapel = "owner";
  }

  // Estado da relação (só importa para inquilino): checado no servidor.
  let estadoRelacao: string | undefined;
  if (targetPapel === "tenant" && viewerId) {
    const aceita = await relacaoAceitaEntreServidor(viewerId, targetId);
    estadoRelacao = aceita ? "aceito" : undefined;
  }

  const pode = podeVerAvatar({
    viewerId: viewerId || "anon",
    targetId,
    targetPapel,
    viewerIsAdmin,
    estadoRelacao,
  });
  if (!pode) return { url: null };

  return { url: await signAvatarPath(targetPath) };
}
