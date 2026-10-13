"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { precisaCodigoParaOperacaoSensivel, urlAtivar2fa } from "@/lib/admin/mfa";
import {
  MSG_CODIGO_RECUPERACAO_INVALIDO,
  MSG_RECUPERACAO_BLOQUEADA,
  VALIDADE_CODIGO_EMAIL_MS,
  aposFalha,
  bloqueado,
  codigoRecuperacaoValido,
  gerarCodigoEmail,
  gerarCodigos,
  hashCodigo,
  hashCodigoEmail,
  senhaRecente,
  type EstadoLimite,
} from "./codigos-recuperacao";

/**
 * 2FA — códigos de recuperação e "refazer" (ordens 58901f0f e 10484c4c).
 * Abordagem: o Supabase não eleva a sessão a aal2 por código de recuperação. Então um código
 * válido (ou o e-mail de confirmação do "refazer") faz o SERVIDOR apagar o fator TOTP da própria
 * pessoa (service role, só depois de conferir tudo); a sessão fica aal1 sem fator e o portão
 * manda cadastrar um app novo — o aal2 volta pelo caminho normal. Nada disso roda no navegador.
 */
type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const ERRO_GERAL = "Não foi possível concluir agora. Tente de novo.";

async function sessao() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { supabase, user: data.user };
}

async function lerControle(admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string) {
  const { data } = await admin.from("mfa_controle").select("falhas, bloqueado_ate, refazer_hash, refazer_expira").eq("user_id", userId).maybeSingle();
  const estado: EstadoLimite = { falhas: data?.falhas ?? 0, bloqueadoAte: data?.bloqueado_ate ? Date.parse(data.bloqueado_ate) : null };
  return { estado, refazerHash: (data?.refazer_hash as string | null) ?? null, refazerExpira: data?.refazer_expira ? Date.parse(data.refazer_expira) : null };
}

async function gravarLimite(admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string, e: EstadoLimite, extra: Record<string, unknown> = {}) {
  await admin.from("mfa_controle").upsert({
    user_id: userId,
    falhas: e.falhas,
    bloqueado_ate: e.bloqueadoAte ? new Date(e.bloqueadoAte).toISOString() : null,
    atualizado_em: new Date().toISOString(),
    ...extra,
  });
}

/** Apaga todos os fatores TOTP da pessoa e os códigos de recuperação (o conjunto antigo morre junto). */
async function apagarFatores(admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string): Promise<boolean> {
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) return false;
  for (const f of data?.factors ?? []) {
    const r = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId });
    if (r.error) return false;
  }
  await admin.from("mfa_codigos_recuperacao").delete().eq("user_id", userId);
  await gravarLimite(admin, userId, { falhas: 0, bloqueadoAte: null }, { refazer_hash: null, refazer_expira: null });
  return true;
}

/** Gera 10 códigos novos (invalida os antigos). Mostrados UMA vez; no banco só o hash. */
export async function gerarCodigosRecuperacao(): Promise<Res<{ codigos: string[] }>> {
  const s = await sessao();
  const admin = createAdminClient();
  if (!s || !admin) return { ok: false, error: ERRO_GERAL };
  // Com fator ativo, só quem acabou de provar o código do app (aal2) gera novos.
  const { data: aal } = await s.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (precisaCodigoParaOperacaoSensivel(aal?.currentLevel, aal?.nextLevel)) return { ok: false, error: "Confirme o código do app antes de gerar novos códigos." };
  const { data: fatores } = await s.supabase.auth.mfa.listFactors();
  if (!fatores?.totp?.length) return { ok: false, error: "Ative a verificação em duas etapas antes de gerar códigos." };
  const codigos = gerarCodigos();
  const { error: e1 } = await admin.from("mfa_codigos_recuperacao").delete().eq("user_id", s.user.id);
  if (e1) return { ok: false, error: ERRO_GERAL };
  const { error: e2 } = await admin
    .from("mfa_codigos_recuperacao")
    .insert(codigos.map((c) => ({ user_id: s.user.id, codigo_hash: hashCodigo(s.user.id, c) })));
  if (e2) return { ok: false, error: ERRO_GERAL };
  return { ok: true, codigos };
}

/** Quantos códigos ainda valem (para o aviso "restam 2 ou menos"). */
export async function contarCodigosRecuperacao(): Promise<Res<{ restantes: number }>> {
  const s = await sessao();
  const admin = createAdminClient();
  if (!s || !admin) return { ok: false, error: ERRO_GERAL };
  const { count, error } = await admin
    .from("mfa_codigos_recuperacao")
    .select("id", { count: "exact", head: true })
    .eq("user_id", s.user.id)
    .is("usado_em", null);
  if (error) return { ok: false, error: ERRO_GERAL };
  return { ok: true, restantes: count ?? 0 };
}

/** Código de recuperação (uso único): conferido no servidor; vale → fator apagado e portão manda cadastrar de novo. */
export async function usarCodigoRecuperacao(bruto: string, destino: string): Promise<Res<{ proximo: string }>> {
  const s = await sessao();
  const admin = createAdminClient();
  if (!s || !admin) return { ok: false, error: ERRO_GERAL };
  const agora = Date.now();
  const { estado } = await lerControle(admin, s.user.id);
  if (bloqueado(estado, agora)) return { ok: false, error: MSG_RECUPERACAO_BLOQUEADA };
  const codigo = codigoRecuperacaoValido(bruto);
  let usou = false;
  if (codigo) {
    // Atômico: só um pedido consegue marcar o código como usado.
    const { data } = await admin
      .from("mfa_codigos_recuperacao")
      .update({ usado_em: new Date(agora).toISOString() })
      .eq("user_id", s.user.id)
      .eq("codigo_hash", hashCodigo(s.user.id, codigo))
      .is("usado_em", null)
      .select("id");
    usou = (data?.length ?? 0) === 1;
  }
  if (!usou) {
    await gravarLimite(admin, s.user.id, aposFalha(estado, agora));
    return { ok: false, error: MSG_CODIGO_RECUPERACAO_INVALIDO };
  }
  if (!(await apagarFatores(admin, s.user.id))) return { ok: false, error: ERRO_GERAL };
  return { ok: true, proximo: urlAtivar2fa(destino) };
}

/** Passo 1 do "refazer": admin com senha digitada há pouco recebe um código de 6 dígitos por e-mail. */
export async function pedirCodigoRefazer(): Promise<Res> {
  const s = await sessao();
  const admin = createAdminClient();
  if (!s || !admin || !s.user.email) return { ok: false, error: ERRO_GERAL };
  const { data: perfil } = await s.supabase.from("profiles").select("role").eq("id", s.user.id).maybeSingle();
  if ((perfil?.role as string | undefined) !== "admin") return { ok: false, error: ERRO_GERAL };
  const agora = Date.now();
  if (!senhaRecente(s.user.last_sign_in_at, agora)) return { ok: false, error: "Confirme sua senha primeiro." };
  const { estado } = await lerControle(admin, s.user.id);
  if (bloqueado(estado, agora)) return { ok: false, error: MSG_RECUPERACAO_BLOQUEADA };
  const codigo = gerarCodigoEmail();
  await gravarLimite(admin, s.user.id, estado, {
    refazer_hash: hashCodigoEmail(s.user.id, codigo),
    refazer_expira: new Date(agora + VALIDADE_CODIGO_EMAIL_MS).toISOString(),
  });
  const r = await sendEmail({
    to: s.user.email,
    subject: "Seu código para refazer a verificação em duas etapas",
    text: `Seu código: ${codigo}\nVale por 15 minutos. Se não foi você, ignore este e-mail e troque a senha.`,
    html: `<p>Seu código para refazer a verificação em duas etapas: <strong style="font-size:20px;letter-spacing:4px">${codigo}</strong></p><p>Vale por 15 minutos. Se não foi você, ignore este e-mail e troque a senha.</p>`,
  });
  if (r.error) return { ok: false, error: "Não foi possível enviar o e-mail agora. Tente de novo." };
  return { ok: true };
}

/** Passo 2 do "refazer": código do e-mail certo → apaga o fator da própria pessoa; segue para cadastrar de novo. */
export async function confirmarRefazer(bruto: string): Promise<Res<{ proximo: string }>> {
  const s = await sessao();
  const admin = createAdminClient();
  if (!s || !admin) return { ok: false, error: ERRO_GERAL };
  const { data: perfil } = await s.supabase.from("profiles").select("role").eq("id", s.user.id).maybeSingle();
  if ((perfil?.role as string | undefined) !== "admin") return { ok: false, error: ERRO_GERAL };
  const agora = Date.now();
  if (!senhaRecente(s.user.last_sign_in_at, agora)) return { ok: false, error: "Confirme sua senha primeiro." };
  const c = await lerControle(admin, s.user.id);
  if (bloqueado(c.estado, agora)) return { ok: false, error: MSG_RECUPERACAO_BLOQUEADA };
  const limpo = bruto.replace(/\s+/g, "");
  const confere = /^\d{6}$/.test(limpo) && !!c.refazerHash && !!c.refazerExpira && c.refazerExpira > agora && hashCodigoEmail(s.user.id, limpo) === c.refazerHash;
  if (!confere) {
    await gravarLimite(admin, s.user.id, aposFalha(c.estado, agora));
    return { ok: false, error: "Código do e-mail inválido ou vencido." };
  }
  if (!(await apagarFatores(admin, s.user.id))) return { ok: false, error: ERRO_GERAL };
  return { ok: true, proximo: urlAtivar2fa("/admin") };
}
