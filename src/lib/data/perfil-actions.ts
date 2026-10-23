"use server";

import { getTelefoneEstado } from "@/lib/data/telefone-actions";
import { cadastroCompleto, faltaNoCadastro } from "@/lib/perfil/cadastro-completo";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerDocumento } from "@/lib/data/documento-servidor";
import { DOCUMENTO_VAZIO_PF, documentoCompleto, mascararCnpj, mascararCpf, msgDocumentoDuplicado, validarDocumento, type DocumentoInput, type TipoPessoa } from "@/lib/documento-pessoa";
import { contemContato } from "@/lib/pedidos/pedidos";
import { validarNome, normalizarTelefone, validarLinkedin, validarMotivoEstadia } from "@/lib/conta-validacao";
import { validarBio, validarCidade, validarIdiomas } from "@/lib/perfil/perfil-publico";
import {
  isCategoriaKey,
  CATEGORIA_NAO_INFORMAR,
  CATEGORIA_OUTRO_PREFIX,
  CATEGORIA_OUTRO_MAXLEN,
} from "@/config/categorias-profissionais";

type Result = { ok: boolean; error?: string };

/**
 * Normaliza o valor para o formato ARMAZENADO, com sanitização SERVIDOR do campo
 * livre "Outro" (máx. 40, MESMA regra do bloqueio de contato — sem telefone/
 * e-mail/apps). Devolve null se inválido.
 */
function normalizarCategoria(raw: string): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (v === CATEGORIA_NAO_INFORMAR) return v;
  if (isCategoriaKey(v)) return v;
  if (v.startsWith(CATEGORIA_OUTRO_PREFIX)) {
    const livre = v.slice(CATEGORIA_OUTRO_PREFIX.length).trim().slice(0, CATEGORIA_OUTRO_MAXLEN);
    if (!livre) return CATEGORIA_OUTRO_PREFIX; // "Outro" sem texto
    if (contemContato(livre)) return null; // bloqueia telefone/e-mail/apps
    return CATEGORIA_OUTRO_PREFIX + livre;
  }
  return null;
}

/** Lê a MINHA categoria profissional (valor armazenado). null se ausente/demo. */
export async function getMinhaCategoria(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("professional_category")
    .eq("id", user.id)
    .maybeSingle();
  return (data?.professional_category as string | null) ?? null;
}

/** Grava a MINHA categoria profissional (RLS: só o próprio perfil). */
export async function setMinhaCategoria(raw: string): Promise<Result> {
  const value = normalizarCategoria(raw);
  if (value === null) {
    return { ok: false, error: "Categoria inválida ou com contato no campo livre." };
  }
  const supabase = await createClient();
  if (!supabase) return { ok: true }; // demo/preview: sem servidor
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada." };
  const { error } = await supabase
    .from("profiles")
    .update({ professional_category: value })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Não foi possível salvar agora." };
  revalidatePath("/dashboard/conta");
  return { ok: true };
}

export interface MeusDados {
  fullName: string;
  email: string;
  phone: string;
  linkedin: string;
  /** Chave de MOTIVOS (pedidos.ts) ou "" — pré-preenche pedidos novos. */
  motivoEstadia: string;
}

/** Lê os MEUS dados pessoais (nome, e-mail, telefone, LinkedIn). */
export async function getMeusDados(): Promise<MeusDados | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("full_name, phone, linkedin_url, motivo_estadia")
    .eq("id", user.id)
    .maybeSingle();
  return {
    fullName: (data?.full_name as string) ?? "",
    email: user.email ?? "",
    phone: (data?.phone as string) ?? "",
    linkedin: (data?.linkedin_url as string) ?? "",
    motivoEstadia: (data?.motivo_estadia as string) ?? "",
  };
}

/**
 * Grava nome, telefone e (opcional) LinkedIn do PRÓPRIO perfil. Antes o botão
 * "Salvar alterações" da Conta não chamava nada — nenhum usuário conseguia
 * salvar. Validação no servidor (fonte da verdade); o banco ainda barra
 * contato no nome (0057). `linkedin` só é gravado quando vier (perfil do modo
 * inquilino).
 */
export async function salvarMeusDados(input: {
  fullName: string;
  phone: string;
  linkedin?: string;
  motivoEstadia?: string;
}): Promise<Result & { dados?: { fullName: string; phone: string | null; linkedin: string | null; motivoEstadia: string | null } }> {
  const nome = validarNome(input.fullName);
  if (!nome.ok) return { ok: false, error: nome.erro };
  const tel = normalizarTelefone(input.phone);
  if (!tel.ok) return { ok: false, error: tel.erro };
  const li = input.linkedin === undefined ? null : validarLinkedin(input.linkedin);
  if (li && !li.ok) return { ok: false, error: li.erro };
  const mo = input.motivoEstadia === undefined ? null : validarMotivoEstadia(input.motivoEstadia);
  if (mo && !mo.ok) return { ok: false, error: mo.erro };
  const motivoEstadia = mo?.ok ? mo.valor : null;

  const supabase = await createClient();
  if (!supabase) return { ok: true, dados: { fullName: nome.valor, phone: tel.valor, linkedin: li?.ok ? li.valor : null, motivoEstadia } };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre de novo." };

  const update: Record<string, string | null> = { full_name: nome.valor, phone: tel.valor };
  if (li?.ok) update.linkedin_url = li.valor;
  if (mo?.ok) update.motivo_estadia = mo.valor;
  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) {
    console.error("[salvarMeusDados]", error.code, error.message);
    return {
      ok: false,
      error: error.code === "42501" || /contato/i.test(error.message)
        ? "O nome não pode ter e-mail, telefone ou link."
        : "Não foi possível salvar agora. Tente de novo.",
    };
  }
  revalidatePath("/dashboard/conta");
  return { ok: true, dados: { fullName: nome.valor, phone: tel.valor, linkedin: li?.ok ? li.valor : null, motivoEstadia } };
}

export interface MeuDocumento {
  tipo: TipoPessoa;
  completo: boolean;
  /** Sempre MASCARADO: o número inteiro não sai do servidor. */
  cpf: string | null;
  cnpj: string | null;
  razaoSocial: string | null;
  cpfRepresentante: string | null;
}

/** O MEU documento (CPF ou CNPJ), mascarado. null sem sessão/demo. */
export async function getMeuDocumento(): Promise<MeuDocumento | null> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const p = await lerDocumento(admin, user.id);
  if (!p) return { ...DOCUMENTO_VAZIO_PF };
  return {
    tipo: p.person_type === "pj" ? "pj" : "pf",
    completo: documentoCompleto(p),
    cpf: mascararCpf(p.cpf),
    cnpj: mascararCnpj(p.cnpj),
    razaoSocial: (p.company_name as string | null) ?? null,
    cpfRepresentante: mascararCpf(p.cpf_representante),
  };
}

/**
 * Grava o MEU documento (Cadastro confiável, 0090). Validação dos dígitos aqui
 * e no banco. Uma vez completo, só a equipe troca (evita trocar de CPF depois
 * de um contrato). O tipo (PF/PJ) é o escolhido no cadastro. Grava pelo
 * servidor: o usuário não edita esses campos direto (0090).
 */
export async function salvarMeuDocumento(input: Omit<DocumentoInput, "tipo">): Promise<Result & { documento?: MeuDocumento }> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, error: "Indisponível no momento." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const atual = await lerDocumento(admin, user.id);
  if (!atual) return { ok: false, error: "Perfil não encontrado." };
  if (documentoCompleto(atual)) return { ok: false, error: "Seu documento já está cadastrado. Para trocar, fale com o suporte." };
  const tipo: TipoPessoa = atual.person_type === "pj" ? "pj" : "pf";
  const v = validarDocumento({ ...input, tipo });
  if (!v.ok) return { ok: false, error: v.erro };
  const update =
    tipo === "pf"
      ? { cpf: v.doc.cpf }
      : { cnpj: v.doc.cnpj, company_name: v.doc.razaoSocial, cpf_representante: v.doc.cpfRepresentante };
  const { error } = await admin.from("profiles").update(update).eq("id", user.id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: msgDocumentoDuplicado(tipo) };
    if (error.code === "23514") return { ok: false, error: tipo === "pf" ? "CPF inválido." : "CNPJ ou CPF do representante inválido." };
    console.error("[salvarMeuDocumento]", error.code, error.message);
    return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
  }
  revalidatePath("/dashboard/conta");
  return { ok: true, documento: (await getMeuDocumento()) ?? undefined };
}

/* ─────────── Perfil público (prompt 6): bio, idiomas e cidade + barra "Complete seu perfil" ─────────── */

export interface MeuPerfilPublico {
  bio: string;
  idiomas: string[];
  cidade: string;
  temFoto: boolean;
  profissao: string | null;
  motivo: string | null;
  /** Já anunciou ao menos um imóvel (a barra não pede profissão/motivo de quem só anuncia). */
  anuncia: boolean;
  /** Celular verificado (prompt 7). undefined = verificação por SMS indisponível: o item não entra na barra. */
  telefone?: boolean;
  /** "Cadastro completo" (Prompt 29): a mesma função que o admin vê na lista de usuários. */
  cadastro: { completo: boolean; falta: string };
  /** CONTA-A: o nome da conta (topo e espelho) e o e-mail confirmado (pílula do espelho). */
  nome: string;
  emailConfirmado: boolean;
}

export async function getMeuPerfilPublico(): Promise<MeuPerfilPublico | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const adminDoc = createAdminClient();
  const [{ data }, { count }, fone, doc] = await Promise.all([
    supabase.from("profiles").select("bio, idiomas, cidade, avatar_url, professional_category, motivo_estadia, full_name").eq("id", user.id).maybeSingle(),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    getTelefoneEstado().catch(() => null),
    // Documento: lido pelo servidor (cliente de serviço); só o "tem/não tem" sai daqui.
    adminDoc ? lerDocumento(adminDoc, user.id).catch(() => null) : Promise.resolve(null),
  ]);
  return {
    bio: (data?.bio as string | null) ?? "",
    idiomas: (data?.idiomas as string[] | null) ?? [],
    cidade: (data?.cidade as string | null) ?? "",
    temFoto: !!data?.avatar_url,
    profissao: (data?.professional_category as string | null) ?? null,
    motivo: (data?.motivo_estadia as string | null) ?? null,
    anuncia: (count ?? 0) > 0,
    telefone: fone?.disponivel ? fone.verificado : undefined,
    nome: ((data?.full_name as string | null) ?? "").trim(),
    emailConfirmado: !!user.email_confirmed_at,
    cadastro: (() => {
      const d = {
        nome: (data?.full_name as string | null) ?? null,
        emailConfirmado: !!user.email_confirmed_at,
        cpf: doc?.cpf ?? null,
        cnpj: doc?.cnpj ?? null,
        foto: !!data?.avatar_url,
      };
      return { completo: cadastroCompleto(d), falta: faltaNoCadastro(d) };
    })(),
  };
}

/** Grava bio, idiomas e cidade do PRÓPRIO perfil. Bio e cidade sem contato (contact-guard). */
export async function salvarMeuPerfilPublico(input: { bio: string; idiomas: string[]; cidade: string }): Promise<Result> {
  const bio = validarBio(input.bio);
  if (!bio.ok) return { ok: false, error: bio.erro };
  const cidade = validarCidade(input.cidade);
  if (!cidade.ok) return { ok: false, error: cidade.erro };
  const idiomas = validarIdiomas(Array.isArray(input.idiomas) ? input.idiomas : []);
  const supabase = await createClient();
  if (!supabase) return { ok: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const { error } = await supabase.from("profiles").update({ bio: bio.valor, idiomas, cidade: cidade.valor }).eq("id", user.id);
  if (error) {
    console.error("[salvarMeuPerfilPublico]", error.code, error.message);
    return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
  }
  revalidatePath("/dashboard/conta");
  return { ok: true };
}
