import crypto from "node:crypto";
import { SITE_URL } from "@/lib/site";
import { getAvatarPath, relacaoAceitaEntreServidor } from "@/lib/data/avatar-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { primeiroNome } from "@/lib/display-name";
import { nomeDepoisDoAceite } from "@/lib/visitas/nome-visita";
import { blocoMoradorHtml, fotoParaOEmail, linhasMoradorTexto, urlAvatarEmail } from "./morador-email";

/**
 * E441, parte B/e-mails — o morador no e-mail ao dono (servidor). A foto só com relação aceita (mesma regra do
 * calendário: candidatura aceita ou contrato); antes disso, ou sem foto, as iniciais. O nome segue a regra da casa:
 * primeiro nome antes do aceite, completo depois (E427).
 */
function segredo(): string {
  return `avatar-email:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? "viva-nomads"}`;
}

export function assinarAvatarEmail(donoId: string, moradorId: string): string {
  return crypto.createHmac("sha256", segredo()).update(`${donoId}:${moradorId}`).digest("hex").slice(0, 32);
}

export function assinaturaAvatarValida(donoId: string, moradorId: string, s: string): boolean {
  const certo = Buffer.from(assinarAvatarEmail(donoId, moradorId));
  const veio = Buffer.from(String(s));
  return veio.length === certo.length && crypto.timingSafeEqual(veio, certo);
}

/** Bloco (HTML + texto) do morador para o e-mail do dono. Best-effort: sem banco, null (o e-mail sai como antes). */
export async function moradorNoEmail(p: { donoId: string; moradorId: string; caminho: string; rotuloLink?: string }): Promise<{ html: string; texto: string } | null> {
  const admin = createAdminClient();
  if (!admin || !p.donoId || !p.moradorId || p.donoId === p.moradorId) return null;
  const [aceita, caminhoFoto, perfil] = await Promise.all([
    relacaoAceitaEntreServidor(p.donoId, p.moradorId).catch(() => false),
    getAvatarPath(p.moradorId).catch(() => null),
    admin.from("profiles").select("full_name").eq("id", p.moradorId).maybeSingle(),
  ]);
  const cheio = (perfil.data as { full_name?: string | null } | null)?.full_name ?? null;
  const nome = (aceita ? nomeDepoisDoAceite(cheio) : primeiroNome(cheio)) || "Morador";
  const m = {
    nome,
    fotoUrl: fotoParaOEmail({ relacaoAceita: aceita, temFoto: !!caminhoFoto, url: urlAvatarEmail(SITE_URL, p.donoId, p.moradorId, assinarAvatarEmail(p.donoId, p.moradorId)) }),
    url: `${SITE_URL}${p.caminho}`,
  };
  return { html: blocoMoradorHtml(m), texto: linhasMoradorTexto(m, p.rotuloLink) };
}
