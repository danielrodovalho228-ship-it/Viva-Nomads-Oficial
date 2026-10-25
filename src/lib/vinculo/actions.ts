"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, HORA } from "@/lib/limites";
import { sendEmail } from "@/lib/notifications/email";
import { emailCodigoVinculo } from "@/lib/notifications/montar-email";
import { SITE_URL } from "@/lib/site";
import { dominioCorporativo } from "./dominio-corporativo";
import { conferirCodigo, gerarCodigo, hashDoCodigo, MAX_TENTATIVAS, VALIDADE_CODIGO_MIN } from "./codigo";

/**
 * Vínculo profissional por e-mail corporativo (ordem 9950ef15, item 2, parte 2). Duas ações, ambas só para quem está
 * logado e só sobre a PRÓPRIA linha (a tabela não tem política de RLS: quem lê e grava é o servidor, pelo id da sessão).
 * O e-mail digitado existe só neste pedido e no envio; no banco ficam o domínio e o hash do código.
 */

type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const ERRO_GERAL = "Não foi possível agora. Tente de novo em instantes.";
export const MSG_DOMINIO_RECUSADO = "Use o e-mail da sua empresa, hospital ou universidade. E-mails como Gmail e Hotmail não servem para este selo.";
export const MSG_MUITOS_PEDIDOS = "Você pediu códigos demais. Aguarde uma hora e tente de novo.";

async function sessao() {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  return user ? { user } : null;
}

/** Passo 1: manda o código de 6 dígitos para o e-mail corporativo informado. */
export async function pedirVinculo(emailBruto: string): Promise<Res<{ dominio: string }>> {
  const s = await sessao();
  const admin = createAdminClient();
  if (!s || !admin) return { ok: false, error: "Entre na sua conta para continuar." };
  const d = dominioCorporativo(typeof emailBruto === "string" ? emailBruto.slice(0, 254) : "");
  if (!d.ok) return { ok: false, error: MSG_DOMINIO_RECUSADO };
  if (!(await consumirLimite(`vinculo-pedido:${s.user.id}`, 5, HORA))) return { ok: false, error: MSG_MUITOS_PEDIDOS };

  const codigo = gerarCodigo();
  const { data: atual } = await admin.from("vinculo_profissional").select("dominio, confirmado_em").eq("user_id", s.user.id).maybeSingle();
  // Um novo pedido para o MESMO domínio não derruba o selo que a pessoa já tem; outro domínio recomeça.
  const manter = atual && atual.dominio === d.dominio ? (atual.confirmado_em as string | null) : null;
  const { error } = await admin.from("vinculo_profissional").upsert({
    user_id: s.user.id,
    dominio: d.dominio,
    codigo_hash: hashDoCodigo(s.user.id, codigo),
    expira_em: new Date(Date.now() + VALIDADE_CODIGO_MIN * 60_000).toISOString(),
    tentativas: 0,
    confirmado_em: manter,
  });
  if (error) {
    console.error("[vinculo] gravar pedido:", error.message);
    return { ok: false, error: ERRO_GERAL };
  }
  const m = emailCodigoVinculo(SITE_URL, { codigo });
  const r = await sendEmail({ to: emailBruto.trim().toLowerCase(), subject: m.assunto, evento: m.evento, usuarioId: s.user.id, imagem: m.imagem, text: m.text, html: m.html });
  if (r.error) return { ok: false, error: "Não foi possível enviar o e-mail agora. Tente de novo." };
  return { ok: true, dominio: d.dominio };
}

/** Passo 2: confere o código. Certo → "Vínculo profissional confirmado" com o nome do domínio. Errado conta uma tentativa. */
export async function confirmarVinculo(codigoBruto: string): Promise<Res<{ dominio: string }>> {
  const s = await sessao();
  const admin = createAdminClient();
  if (!s || !admin) return { ok: false, error: "Entre na sua conta para continuar." };
  const { data: p } = await admin
    .from("vinculo_profissional")
    .select("dominio, codigo_hash, expira_em, tentativas")
    .eq("user_id", s.user.id)
    .maybeSingle();
  if (!p) return { ok: false, error: "Peça um código primeiro." };
  const tentativas = Number(p.tentativas);
  const r = conferirCodigo(s.user.id, typeof codigoBruto === "string" ? codigoBruto.slice(0, 16) : "", {
    codigoHash: p.codigo_hash as string,
    expiraEm: p.expira_em as string,
    tentativas,
  }, new Date());
  if (r === "bloqueado") return { ok: false, error: "Muitas tentativas. Peça um novo código." };
  if (r === "expirado") return { ok: false, error: "O código venceu. Peça um novo." };
  if (r === "errado") {
    // A tentativa só conta se ninguém mudou a linha no meio (mesmo valor lido): dois palpites ao mesmo tempo não furam o limite.
    await admin.from("vinculo_profissional").update({ tentativas: tentativas + 1 }).eq("user_id", s.user.id).eq("tentativas", tentativas);
    const restam = MAX_TENTATIVAS - tentativas - 1;
    return { ok: false, error: restam > 0 ? "Código incorreto. Confira o e-mail e tente de novo." : "Muitas tentativas. Peça um novo código." };
  }
  // Consumo único: a confirmação só vale se a linha ainda está como foi lida; o hash zerado impede reusar o mesmo código.
  const { data: feito } = await admin
    .from("vinculo_profissional")
    .update({ confirmado_em: new Date().toISOString(), tentativas: MAX_TENTATIVAS })
    .eq("user_id", s.user.id)
    .eq("codigo_hash", p.codigo_hash as string)
    .eq("tentativas", tentativas)
    .select("user_id");
  if (!feito?.length) return { ok: false, error: ERRO_GERAL };
  return { ok: true, dominio: p.dominio as string };
}
