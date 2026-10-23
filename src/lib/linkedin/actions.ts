"use server";
/*
  63-B — o que a Conta usa: o meu selo do LinkedIn (com a chave), desconectar e as redes PRIVADAS da própria pessoa.
*/
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { REDES_USUARIO_ATIVO } from "@/lib/flags";
import { linkedinAtivo } from "./chave";
import { configLinkedin, seloLinkedinDe } from "./servidor";
import { textoConectadoEm } from "./regras";
import { validarRedePessoal } from "./redes";

export interface MeuLinkedin {
  /** A chave está ligada e há configuração (LinkedIn de verdade ou o simulado do laboratório). */
  ativo: boolean;
  conectado: boolean;
  /** "Conectado em 23/10/2026". */
  texto: string | null;
}

async function eu() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, uid: user.id } : null;
}

export async function meuLinkedin(): Promise<MeuLinkedin> {
  const ativo = (await linkedinAtivo()) && !!configLinkedin();
  if (!ativo) return { ativo: false, conectado: false, texto: null };
  const s = await eu();
  if (!s) return { ativo, conectado: false, texto: null };
  const selo = await seloLinkedinDe(s.uid);
  return { ativo, conectado: !!selo, texto: selo ? textoConectadoEm(selo.conectadoEm) : null };
}

/** Desconectar: apaga a linha (o selo some na hora, sem cache) e registra só a data do evento. */
export async function desconectarLinkedin(): Promise<{ ok: boolean; erro?: string }> {
  const s = await eu();
  const admin = createAdminClient();
  if (!s || !admin) return { ok: false, erro: "Entre na sua conta para desconectar." };
  const { error } = await admin.from("confianca_linkedin").delete().eq("user_id", s.uid);
  if (error) return { ok: false, erro: "Não foi possível desconectar agora. Tente de novo." };
  await admin.from("eventos").insert({ tipo: "linkedin_desconectado" }).then(() => null, () => null);
  revalidatePath("/dashboard/conta");
  return { ok: true };
}

export interface MinhasRedes {
  instagram: string;
  facebook: string;
  tiktok: string;
}

/** Redes da própria pessoa (só com REDES_USUARIO_ATIVO). null = chave desligada: a tela não mostra os campos. */
export async function minhasRedes(): Promise<MinhasRedes | null> {
  if (!REDES_USUARIO_ATIVO) return null;
  const s = await eu();
  if (!s) return null;
  const { data } = await s.supabase.from("perfil_redes").select("instagram, facebook, tiktok").eq("user_id", s.uid).maybeSingle();
  const r = (data ?? {}) as Partial<Record<keyof MinhasRedes, string | null>>;
  return { instagram: r.instagram ?? "", facebook: r.facebook ?? "", tiktok: r.tiktok ?? "" };
}

export async function salvarMinhasRedes(input: MinhasRedes): Promise<{ ok: boolean; erro?: string }> {
  if (!REDES_USUARIO_ATIVO) return { ok: false, erro: "Indisponível." };
  const s = await eu();
  if (!s) return { ok: false, erro: "Entre na sua conta." };
  const linha: Record<string, string | null> = {};
  for (const rede of ["instagram", "facebook", "tiktok"] as const) {
    const v = validarRedePessoal(rede, input[rede]);
    if (!v.ok) return { ok: false, erro: v.erro };
    linha[rede] = v.valor;
  }
  const { error } = await s.supabase.from("perfil_redes").upsert({ user_id: s.uid, ...linha, atualizado_em: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, erro: "Não foi possível salvar agora." };
  return { ok: true };
}
