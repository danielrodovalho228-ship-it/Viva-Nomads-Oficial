"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, HORA } from "@/lib/limites";
import { registrarSimulado } from "@/lib/integracoes";
import { smsDisponivel } from "@/lib/telefone/disponibilidade";
import {
  CODIGO_SIMULADO,
  ERRO_CODIGO,
  ERRO_INDISPONIVEL,
  ERRO_LIMITE,
  ERRO_NUMERO_EM_USO,
  chavesLimiteSms,
  codigoValido,
  limparCodigo,
  seloTelefone,
  validarCelularBR,
} from "@/lib/telefone/telefone";

/*
  Verificação de telefone (prompt 7). O código é o NATIVO do Supabase Auth:
  updateUser({ phone }) envia; verifyOtp({ phone, token, type: "phone_change" }) confirma.
  No laboratório (INTEGRACOES_SIMULADAS) nada sai para a rede: código fixo, só lá.
  O número NUNCA vai para log, URL ou tabela da Viva (fica só no Supabase Auth).
*/

export interface EstadoTelefone {
  disponivel: boolean;
  simulado: boolean;
  verificado: boolean;
  /** Pediu código e ainda não confirmou. */
  pendente: boolean;
}

type Resultado = { ok: true } | { ok: false; error: string };

const ERRO_ENVIO = "Não foi possível enviar o código agora. Tente de novo em instantes.";

async function ipHashAtual(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim() || "desconhecido";
  return crypto.createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "viva-nomads").update(`ip:${ip}`).digest("hex").slice(0, 32);
}

async function usuarioAtual() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

/** Estado da verificação da PRÓPRIA conta (sem o número). */
export async function getTelefoneEstado(): Promise<EstadoTelefone | null> {
  const s = await usuarioAtual();
  if (!s) return null;
  const disp = await smsDisponivel();
  const admin = createAdminClient();
  if (!admin) return { ...disp, verificado: false, pendente: false };
  const [{ data: u }, { data: tv }] = await Promise.all([
    admin.auth.admin.getUserById(s.user.id),
    admin.from("telefone_verificacao").select("verificado_em, pedido_em").eq("user_id", s.user.id).maybeSingle(),
  ]);
  const verificado = seloTelefone({ phoneConfirmedAt: u?.user?.phone_confirmed_at, verificadoEm: tv?.verificado_em as string | null });
  return { ...disp, verificado, pendente: !verificado && !!tv?.pedido_em };
}

/** Envia o código de 6 dígitos. Pedir para um número zera o selo até confirmar. */
/**
 * O selo "Telefone verificado" aparece na página pública do proprietário e no cartão dos anúncios dele, que são
 * páginas em cache (revalidate 60 s): ao ganhar ou perder o selo, renova essas páginas na hora.
 */
async function renovarPaginasDoSelo(admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string) {
  revalidatePath(`/proprietario/${userId}`);
  const { data } = await admin.from("properties").select("id").eq("owner_id", userId).limit(200);
  for (const p of (data ?? []) as { id: string }[]) revalidatePath(`/imoveis/${p.id}`);
}

export async function enviarCodigoTelefone(numero: string): Promise<Resultado> {
  const s = await usuarioAtual();
  if (!s) return { ok: false, error: "Entre na sua conta para verificar o celular." };
  const disp = await smsDisponivel();
  if (!disp.disponivel) return { ok: false, error: ERRO_INDISPONIVEL };
  const v = validarCelularBR(numero);
  if (!v.ok) return { ok: false, error: v.erro };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: ERRO_ENVIO };

  // Número já confirmado em outra conta: recusa neutra (não diz de quem é).
  const { data: emUso, error: eUso } = await admin.rpc("telefone_em_uso", { p_phone: v.e164, p_user: s.user.id });
  if (eUso) return { ok: false, error: ERRO_ENVIO };
  if (emUso === true) return { ok: false, error: ERRO_NUMERO_EM_USO };

  // 3 por hora e 5 por dia, por usuário E por IP.
  const ip = await ipHashAtual();
  for (const l of chavesLimiteSms(s.user.id, ip)) {
    if (!(await consumirLimite(l.chave, l.maximo, l.janelaSegundos))) return { ok: false, error: ERRO_LIMITE };
  }

  // Zera o selo ANTES de enviar: trocar o número só volta a valer depois do código.
  const { error: eTv } = await admin
    .from("telefone_verificacao")
    .upsert({ user_id: s.user.id, verificado_em: null, pedido_em: new Date().toISOString(), atualizado_em: new Date().toISOString() });
  if (eTv) return { ok: false, error: ERRO_ENVIO };
  await renovarPaginasDoSelo(admin, s.user.id);

  if (disp.simulado) {
    const { error } = await admin.auth.admin.updateUserById(s.user.id, { phone: v.e164 });
    if (error) return { ok: false, error: /already|exists|registered/i.test(error.message) ? ERRO_NUMERO_EM_USO : ERRO_ENVIO };
    await registrarSimulado("sms", { acao: "codigo_enviado" });
    return { ok: true };
  }

  const { error } = await s.supabase.auth.updateUser({ phone: v.e164 });
  if (error) {
    console.error("[telefone] envio do código falhou:", error.code ?? error.status ?? "erro");
    if (/already|exists|registered/i.test(error.message)) return { ok: false, error: ERRO_NUMERO_EM_USO };
    if (error.status === 429 || /rate|too many/i.test(error.message)) return { ok: false, error: ERRO_LIMITE };
    return { ok: false, error: ERRO_ENVIO };
  }
  return { ok: true };
}

/** Confirma o código. Certo → selo "Telefone verificado". */
export async function confirmarCodigoTelefone(numero: string, codigoDigitado: string): Promise<Resultado> {
  const s = await usuarioAtual();
  if (!s) return { ok: false, error: "Entre na sua conta para verificar o celular." };
  const disp = await smsDisponivel();
  if (!disp.disponivel) return { ok: false, error: ERRO_INDISPONIVEL };
  const v = validarCelularBR(numero);
  if (!v.ok) return { ok: false, error: v.erro };
  const codigo = limparCodigo(codigoDigitado);
  if (!codigoValido(codigo)) return { ok: false, error: ERRO_CODIGO };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: ERRO_CODIGO };
  // Tentativas de código também têm limite (força bruta).
  if (!(await consumirLimite(`sms:confirma:u:${s.user.id}`, 10, HORA))) return { ok: false, error: ERRO_LIMITE };

  const { data: tv } = await admin.from("telefone_verificacao").select("pedido_em").eq("user_id", s.user.id).maybeSingle();
  if (!tv?.pedido_em) return { ok: false, error: ERRO_CODIGO };

  if (disp.simulado) {
    const { data: u } = await admin.auth.admin.getUserById(s.user.id);
    if (u?.user?.phone !== v.e164 || codigo !== CODIGO_SIMULADO) return { ok: false, error: ERRO_CODIGO };
    const { error } = await admin.auth.admin.updateUserById(s.user.id, { phone_confirm: true });
    if (error) return { ok: false, error: ERRO_CODIGO };
    await registrarSimulado("sms", { acao: "codigo_confirmado" });
  } else {
    const { error } = await s.supabase.auth.verifyOtp({ phone: v.e164, token: codigo, type: "phone_change" });
    if (error) return { ok: false, error: ERRO_CODIGO };
  }

  const agora = new Date().toISOString();
  const { error } = await admin.from("telefone_verificacao").upsert({ user_id: s.user.id, verificado_em: agora, pedido_em: null, atualizado_em: agora });
  if (error) return { ok: false, error: ERRO_CODIGO };
  await renovarPaginasDoSelo(admin, s.user.id);
  return { ok: true };
}
