import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { HORA, situacaoLimite } from "@/lib/limites";
import {
  LIMITE_QA_POR_HORA,
  chaveConfere,
  chaveLimiteConta,
  chaveLimiteIp,
  contaPermitida,
  emailNoPadrao,
  emailNormalizado,
  papelDaContaNova,
  type PerfilQa,
} from "./entrar";

/*
  QA-LOGIN-B — a QA entra direto numa conta de TESTE, sem código por e-mail. Ordem das travas:
    1. sem QA_LOGIN_KEY → 404 (a rota "não existe");
    2. o IP gasta uma tentativa (30/h) antes da chave ser conferida; chave errada → 404;
    3. conta existente: só de teste, morador/proprietário, sem 2FA → senão 404 (administrador nunca);
       conta inexistente: só cria se o e-mail casar com QA_EMAIL_PADRAO (is_teste = true na mesma operação) → senão 404;
    4. 30 entradas/h por conta;
    5. sessão: generateLink(magiclink) + verifyOtp no servidor com o token_hash → cookies. Nenhum e-mail sai.
  O registro (qa_entradas) guarda horário, conta e o hash do IP — nunca a chave nem o e-mail.
*/

export type ResultadoQa = { status: 200; userId: string } | { status: 404 | 429 | 503 };

const NAO_EXISTE = { status: 404 } as const;

export function qaLoginLigado(): boolean {
  return !!process.env.QA_LOGIN_KEY;
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

async function temFator2fa(admin: Admin, userId: string): Promise<boolean> {
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  // Na dúvida, trata como conta com 2FA (fecha).
  if (error) return true;
  return (data?.factors ?? []).length > 0;
}

async function criarContaDeTeste(admin: Admin, email: string, papel: "owner" | "tenant"): Promise<string | null> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { role: papel, full_name: "Conta de teste QA" },
  });
  const id = data?.user?.id;
  if (error || !id) return null;
  // O perfil nasce pelo gatilho do cadastro; aqui ele vira conta de teste. Sem isso, a conta não fica.
  const { data: marcada } = await admin.from("profiles").update({ is_teste: true, role: papel }).eq("id", id).select("id");
  if (!marcada?.length) {
    await admin.auth.admin.deleteUser(id).catch(() => null);
    return null;
  }
  return id;
}

export async function entrarComoQa(entrada: { email: unknown; chave: unknown; papel?: unknown }, ipHash: string): Promise<ResultadoQa> {
  const esperada = process.env.QA_LOGIN_KEY;
  if (!esperada) return NAO_EXISTE;
  const chaveOk = chaveConfere(entrada.chave, esperada);
  const limiteIp = await situacaoLimite(chaveLimiteIp(ipHash), LIMITE_QA_POR_HORA, HORA);
  if (!chaveOk) return NAO_EXISTE;
  if (limiteIp === "estourou") return { status: 429 };
  if (limiteIp === "erro") return { status: 503 };

  const email = emailNormalizado(entrada.email);
  if (!email) return NAO_EXISTE;
  const admin = createAdminClient();
  if (!admin) return { status: 503 };

  const { data: p } = await admin.from("profiles").select("id, role, is_teste").eq("email", email).maybeSingle();
  const perfil = p as (PerfilQa & { id: string }) | null;
  let userId: string;
  let criada = false;
  if (perfil) {
    if (!contaPermitida(perfil, false)) return NAO_EXISTE;
    if (await temFator2fa(admin, perfil.id)) return NAO_EXISTE;
    userId = perfil.id;
  } else {
    if (!emailNoPadrao(email, process.env.QA_EMAIL_PADRAO)) return NAO_EXISTE;
    const novo = await criarContaDeTeste(admin, email, papelDaContaNova(entrada.papel));
    if (!novo) return NAO_EXISTE;
    userId = novo;
    criada = true;
  }

  const limiteConta = await situacaoLimite(chaveLimiteConta(email), LIMITE_QA_POR_HORA, HORA);
  if (limiteConta === "estourou") return { status: 429 };
  if (limiteConta === "erro") return { status: 503 };

  // Sessão sem e-mail: o link é gerado (não enviado) e o token_hash é verificado aqui, gravando os cookies.
  const { data: link, error: eLink } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const token_hash = link?.properties?.hashed_token;
  if (eLink || !token_hash) return { status: 503 };
  const supabase = await createClient();
  if (!supabase) return { status: 503 };
  const { error: eOtp } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash });
  if (eOtp) return { status: 503 };

  await admin.from("qa_entradas").insert({ usuario_id: userId, ip_hash: ipHash, conta_criada: criada });
  return { status: 200, userId };
}
