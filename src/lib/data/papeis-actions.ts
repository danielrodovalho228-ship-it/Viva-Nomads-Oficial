"use server";

import { createClient } from "@/lib/supabase/server";
import { fatosDaConta } from "@/lib/data/ativacao";
import { getPerfilProprietario } from "@/lib/data/perfil-proprietario";
import { signAvatarPath } from "@/lib/data/avatar-url";
import { papeisDaConta, type PapelDaConta } from "@/lib/onboarding/ativacao";
import { nomeCurto } from "@/lib/perfil/perfil-publico";
import { createAdminClient } from "@/lib/supabase/admin";
import { estadoIdentidade } from "@/lib/identidade/estado-servidor";
import { degrausPerfil, type Degrau } from "@/lib/onboarding/degraus";

/** "Seus papéis" no Perfil (Prompt 43): derivados do que a conta tem — sem modo escolhido à mão. */
export async function meusPapeis(): Promise<PapelDaConta[] | null> {
  const fatos = await fatosDaConta(null).catch(() => null);
  return fatos ? papeisDaConta(fatos) : null;
}

/** O que os outros veem do seu perfil: só nome curto, foto, cidade, frase, idiomas, avaliações e selos. */
export interface MeuPerfilPublico {
  nome: string;
  fotoUrl: string | null;
  cidade: string | null;
  bio: string | null;
  idiomas: string[];
  desde: string | null;
  selos: string[];
  avaliacoes: { media: number; n: number };
  /** E55: tempo de resposta no chat (só para quem anuncia e com conversas suficientes). */
  resposta: { taxa: number; tempo: string } | null;
  /** E55: tem o papel de proprietário (a faixa do anúncio existe). */
  ehDono: boolean;
  /** Link da página pública, quando ela existe (quem anuncia). */
  href: string | null;
}

export async function meuPerfilPublico(): Promise<MeuPerfilPublico | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // Quem anuncia: a MESMA leitura da página pública (/proprietario/[id]).
  const dono = await getPerfilProprietario(user.id).catch(() => null);
  if (dono) {
    return {
      nome: dono.nome,
      fotoUrl: dono.fotoUrl,
      cidade: dono.cidade,
      bio: dono.bio,
      idiomas: dono.idiomas,
      desde: dono.desde,
      selos: dono.selos,
      avaliacoes: dono.reputacao,
      resposta: dono.resposta,
      ehDono: true,
      href: `/proprietario/${user.id}`,
    };
  }
  // Morador: o que o dono vê no cartão de quem pede (nome curto, foto, cidade, frase e idiomas).
  const { data } = await supabase.from("profiles").select("full_name, avatar_url, cidade, bio, idiomas, created_at").eq("id", user.id).maybeSingle();
  const p = (data ?? {}) as { full_name?: string | null; avatar_url?: string | null; cidade?: string | null; bio?: string | null; idiomas?: string[] | null; created_at?: string | null };
  return {
    nome: nomeCurto(p.full_name) ?? "Você",
    fotoUrl: await signAvatarPath(p.avatar_url ?? null, user.id).catch(() => null),
    cidade: p.cidade ?? null,
    bio: p.bio ?? null,
    idiomas: p.idiomas ?? [],
    desde: p.created_at ?? null,
    selos: user.email_confirmed_at ? ["E-mail confirmado"] : [],
    avaliacoes: { media: 0, n: 0 },
    resposta: null,
    ehDono: false,
    href: null,
  };
}

/** Os 4 degraus do perfil (Prompt 43): e-mail, nome e foto, telefone e identidade, com o estado de cada um. */
export async function meusDegraus(): Promise<Degrau[] | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("full_name, avatar_url, phone").eq("id", user.id).maybeSingle();
  const p = (data ?? {}) as { full_name?: string | null; avatar_url?: string | null; phone?: string | null };
  const admin = createAdminClient();
  const identidade = admin ? await estadoIdentidade(admin, user.id).catch(() => null) : null;
  return degrausPerfil({
    emailConfirmado: !!user.email_confirmed_at,
    temNome: !!p.full_name?.trim(),
    temFoto: !!p.avatar_url,
    temTelefone: !!p.phone?.trim(),
    identidadeConfirmada: identidade?.estado === "confirmada",
  });
}
