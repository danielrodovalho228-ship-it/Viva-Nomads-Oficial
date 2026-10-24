import "server-only";
/*
  FOTO-NA-HORA-B — o lado do servidor da prova feita na hora: tokens (só o hash vai ao banco), a busca de foto repetida
  e o consumo do token. As regras puras ficam em prova-camera.ts.
*/
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TOKEN_FORMATO, hashComparavel, type CapturaGravada } from "./prova-camera";

type Admin = SupabaseClient;

/** Token que vai ao navegador (32 bytes, base64url) e o hash que fica no banco. */
export function novoToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashDoToken(token) };
}

export const hashDoToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export interface CapturaLida extends CapturaGravada {
  id: string;
  foto_hash: string | null;
  capturada_em: string | null;
}

export async function capturaPeloToken(admin: Admin, token: unknown): Promise<CapturaLida | null> {
  if (typeof token !== "string" || !TOKEN_FORMATO.test(token)) return null;
  const { data } = await admin
    .from("prova_capturas")
    .select("id, owner_id, property_id, chave, expira_em, usado_em, foto_path, foto_hash, capturada_em")
    .eq("token_hash", hashDoToken(token))
    .maybeSingle();
  return (data as CapturaLida | null) ?? null;
}

/**
 * A foto já foi usada? Bate (hash perceptual igual) com uma foto da galeria deste anúncio ou do mesmo dono
 * (fotos_anuncio_hash: o hash sobrevive à remoção do anúncio), ou com qualquer outra prova de qualquer anúncio
 * (nivel_itens e capturas ainda não gravadas). Hash liso (sem informação) não é comparado.
 */
export async function fotoJaUsada(admin: Admin, hash: string | null, ctx: { propertyId: string; ownerId: string; capturaId: string }): Promise<boolean> {
  if (!hashComparavel(hash)) return false;
  const [galeria, provas, capturas] = await Promise.all([
    admin.from("fotos_anuncio_hash").select("id").eq("hash", hash).or(`property_id.eq.${ctx.propertyId},owner_id.eq.${ctx.ownerId}`).limit(1),
    admin.from("nivel_itens").select("chave").eq("foto_hash", hash).limit(1),
    admin.from("prova_capturas").select("id").eq("foto_hash", hash).neq("id", ctx.capturaId).limit(1),
  ]);
  return !!(galeria.data?.length || provas.data?.length || capturas.data?.length);
}
