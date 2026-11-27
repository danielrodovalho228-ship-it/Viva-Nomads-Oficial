/*
  E1079 (ORDEM-DUET-386): a FOTO de perfil da conta nas superfícies do avaliador. Fonte única: a foto de perfil que a
  pessoa já envia em Conta (profiles.avatar_url, bucket privado). Foto é incentivada, nunca obrigatória: sem foto —
  ou se esta leitura falhar — o cartão mostra as iniciais (o Avatar da casa), nunca um espaço vazio.
*/
import { createAdminClient } from "@/lib/supabase/admin";
import { signAvatarPath } from "@/lib/data/avatar-url";

/** userId → URL assinada da foto de perfil. Só entram as contas que têm foto. */
export async function fotosDePerfil(userIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const fotos = new Map<string, string>();
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  if (ids.length === 0) return fotos;
  try {
    const admin = createAdminClient();
    if (!admin) return fotos;
    const { data, error } = await admin.from("profiles").select("id, avatar_url").in("id", ids);
    if (error) return fotos;
    await Promise.all(
      ((data ?? []) as { id: string; avatar_url: string | null }[]).map(async (p) => {
        if (!p.avatar_url) return;
        const url = await signAvatarPath(p.avatar_url, p.id);
        if (url) fotos.set(p.id, url);
      }),
    );
  } catch {
    // Foto é enfeite: uma falha aqui não derruba a tela; ficam as iniciais.
  }
  return fotos;
}
