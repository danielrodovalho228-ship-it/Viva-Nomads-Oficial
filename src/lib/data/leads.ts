import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { categoriaLabelParaDono } from "@/config/categorias-profissionais";
import { motivoParaDono } from "@/lib/pedidos/pedidos";
import { dataBR } from "@/lib/utils";
import { SAMPLE_LEADS, type Lead, type Light } from "./lead-types";
import { cartaoCandidato } from "@/lib/perfil/perfil-publico";
import { linkedinConectados } from "@/lib/linkedin/servidor";
import { signAvatarPath } from "@/lib/data/avatar-url";
import { getReputacao } from "@/lib/data/avaliacoes-actions";
import { estadosIdentidade } from "@/lib/identidade/estado-servidor";
import { donoVeFichaPet, resumoPetsCandidatura, type PetResumo } from "@/lib/anuncio/ficha-pet-dono";

// Re-exporta os utilitários puros para compatibilidade com importações server-side.
export { SAMPLE_LEADS, LIGHT_SHORT, leadScore, leadSummary } from "./lead-types";
export type { Lead, Light } from "./lead-types";

interface LeadRow {
  id: string;
  status: string;
  tenant_id: string;
  property_id: string;
  property: { title: string | null } | null;
}

interface VerificacaoRow {
  tenant_id: string;
  traffic_light: Light | null;
  risk_categories: string[] | null;
}

/**
 * Prompt 6 (17/10): antes do aceite o proprietário vê "Candidato(a)" — sem nome, foto ou contato, só os
 * sinais; depois do aceite, nome curto (primeiro nome + inicial) e foto. Contato nunca. Regra pura em
 * src/lib/perfil/perfil-publico.ts (cartaoCandidato).
 */
/**
 * Lista os leads do proprietário logado. No modo demonstração (sem Supabase)
 * mostra exemplos; no modo REAL nunca inventa leads — sem sessão, erro ou banco
 * vazio devolve lista vazia (a página mostra o estado "ainda sem leads").
 */
export async function listLeads(): Promise<Lead[]> {
  const supabase = await createClient();
  if (!supabase) return SAMPLE_LEADS;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("leads")
    .select(
      `id, status, tenant_id, property_id,
       property:properties!leads_property_id_fkey ( title )`
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  const rows = data as unknown as LeadRow[];

  // leads e tenant_verifications não têm FK entre si (o embed dava 400 e a
  // lista vinha vazia), e a RLS de tenant_verifications só deixa o admin ler.
  // Busca pelo servidor SÓ os inquilinos dos leads deste proprietário (a
  // verificação mais recente de cada um).
  const verificacoes = new Map<string, VerificacaoRow>();
  const admin = createAdminClient();
  const tenantIds = [...new Set(rows.map((r) => r.tenant_id))];
  // Nome e categoria do inquilino: a RLS de profiles só deixa a própria pessoa
  // (e o admin) ler — o embed voltava vazio e o dono via "Interessado" até
  // depois do aceite. Lidos pelo servidor SÓ para os inquilinos dos leads deste
  // dono, e só nome + categoria (nunca e-mail ou telefone). O nome passa por
  // nomeExibido: primeiro nome antes do aceite, completo depois.
  type PerfilLinha = { full_name: string | null; professional_category: string | null; avatar_url: string | null; created_at: string | null };
  const perfis = new Map<string, PerfilLinha>();
  if (admin && tenantIds.length > 0) {
    const { data: ps } = await admin.from("profiles").select("id, full_name, professional_category, avatar_url, created_at").in("id", tenantIds);
    for (const p of (ps ?? []) as (PerfilLinha & { id: string })[]) perfis.set(p.id, p);
  }
  // Sinais do candidato (prompt 6): pets da ficha, e-mail confirmado (selo real) e reputação — lidos pelo
  // servidor só para os inquilinos dos leads deste dono. Nunca e-mail ou telefone em si.
  const pets = new Map<string, number>();
  // Ficha do pet para o dono (complemento do #876): nome, espécie e porte no cartão; o resto só em "Ver ficha do pet".
  const petsResumo = new Map<string, PetResumo[]>();
  const contratoDaCandidatura = new Map<string, string>();
  const emailOk = new Map<string, boolean>();
  const reputacoes = new Map<string, { media: number; n: number }>();
  const foneOk = new Map<string, boolean>();
  // 63-B: selo "LinkedIn conectado" (só o sim/não; nunca link, nome ou foto do LinkedIn).
  let linkedin = new Set<string>();
  if (admin && tenantIds.length > 0) {
    linkedin = await linkedinConectados(tenantIds, admin);
    // Selo "Telefone verificado" (0150): só o sim/não, nunca o número.
    const { data: fs, error: eFs } = await admin.rpc("telefones_verificados", { p_ids: tenantIds });
    if (!eFs) for (const f of (fs ?? []) as { id: string; verificado: boolean }[]) foneOk.set(f.id, f.verificado);
    const { data: ps } = await admin.from("pets_inquilino").select("user_id, nome, especie, porte").in("user_id", tenantIds).order("criado_em");
    for (const p of (ps ?? []) as ({ user_id: string } & PetResumo)[]) {
      pets.set(p.user_id, (pets.get(p.user_id) ?? 0) + 1);
      petsResumo.set(p.user_id, [...(petsResumo.get(p.user_id) ?? []), { nome: p.nome, especie: p.especie, porte: p.porte }]);
    }
    // Contrato mais recente de cada candidatura (imóvel + inquilino): encerrado ou cancelado tira a ficha do dono.
    const { data: cs } = await admin
      .from("contratos")
      .select("property_id, tenant_id, status, created_at")
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: false });
    for (const c of (cs ?? []) as { property_id: string; tenant_id: string; status: string }[]) {
      const k = `${c.property_id}:${c.tenant_id}`;
      if (!contratoDaCandidatura.has(k)) contratoDaCandidatura.set(k, c.status);
    }
    await Promise.all(
      tenantIds.map(async (id) => {
        const [u, rep] = await Promise.all([admin.auth.admin.getUserById(id).catch(() => null), getReputacao(id).catch(() => null)]);
        emailOk.set(id, !!u?.data?.user?.email_confirmed_at);
        if (rep) reputacoes.set(id, rep);
      }),
    );
  }
  if (admin && tenantIds.length > 0) {
    const { data: vs } = await admin
      .from("tenant_verifications")
      .select("tenant_id, traffic_light, risk_categories")
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: false });
    for (const v of (vs ?? []) as VerificacaoRow[]) {
      if (!verificacoes.has(v.tenant_id)) verificacoes.set(v.tenant_id, v);
    }
  }

  // Identidade do candidato pela fonte única (complemento do prompt 23): o mesmo texto que ele vê na Conta.
  const identidades = admin && tenantIds.length > 0 ? await estadosIdentidade(admin, tenantIds) : new Map();

  // Motivo da estadia: a coluna não é liberada ao navegador (SELECT por coluna em leads);
  // lido pelo servidor só dos leads deste dono (ids já filtrados pela RLS acima).
  const motivos = new Map<string, string>();
  const inicios = new Map<string, string>();
  const ocupantes = new Map<string, number>();
  if (admin && rows.length > 0) {
    const { data: ms } = await admin.from("leads").select("id, motivo_estadia, inicio_desejado, qtd_ocupantes").in("id", rows.map((r) => r.id));
    for (const m of (ms ?? []) as { id: string; motivo_estadia: string | null; inicio_desejado: string | null; qtd_ocupantes: number | null }[]) {
      if (m.qtd_ocupantes) ocupantes.set(m.id, m.qtd_ocupantes);
      const rotulo = motivoParaDono(m.motivo_estadia);
      if (rotulo) motivos.set(m.id, rotulo);
      if (m.inicio_desejado) inicios.set(m.id, m.inicio_desejado);
    }
  }
  // Foto só depois do aceite (podeVerAvatar: foto do inquilino só com relação aceita).
  const fotos = new Map<string, string | null>();
  await Promise.all(
    rows
      .filter((r) => r.status === "accepted")
      .map(async (r) => fotos.set(r.id, await signAvatarPath(perfis.get(r.tenant_id)?.avatar_url ?? null, r.tenant_id))),
  );

  return rows.map((r) => {
    const v = verificacoes.get(r.tenant_id);
    const fichaPet = donoVeFichaPet({ leadStatus: r.status, contratoStatus: contratoDaCandidatura.get(`${r.property_id}:${r.tenant_id}`) ?? null })
      ? resumoPetsCandidatura(petsResumo.get(r.tenant_id) ?? [])
      : null;
    const t = perfis.get(r.tenant_id);
    const cartao = cartaoCandidato(
      {
        nome: t?.full_name ?? null,
        fotoUrl: fotos.get(r.id) ?? null,
        profissao: null, // a categoria já vai em `category`
        motivo: null, // idem `motivo`
        inicioDesejado: inicios.has(r.id) ? dataBR(inicios.get(r.id)!) : null,
        qtdOcupantes: ocupantes.get(r.id) ?? null,
        // Com a ficha visível, "Com 1 pet · Totó (cão, porte médio)" substitui o "Com 1 pet".
        pets: fichaPet ? 0 : (pets.get(r.tenant_id) ?? 0),
        desde: t?.created_at ?? null,
        reputacao: reputacoes.get(r.tenant_id) ?? null,
        emailConfirmado: emailOk.get(r.tenant_id) ?? false,
        telefoneVerificado: foneOk.get(r.tenant_id) ?? false,
        linkedinConectado: linkedin.has(r.tenant_id),
      },
      r.status === "accepted",
    );
    return {
      id: r.id,
      status: r.status,
      name: cartao.titulo,
      fotoUrl: cartao.fotoUrl,
      sinais: cartao.sinais,
      selos: cartao.selos,
      reputacao: cartao.reputacao,
      property: r.property?.title ?? "Imóvel",
      category: categoriaLabelParaDono(t?.professional_category) || "—",
      riskCategories: v?.risk_categories ?? ["Verificação pendente"],
      light: v?.traffic_light ?? "yellow",
      verified: !!v?.traffic_light,
      identidade: identidades.get(r.tenant_id) ?? null,
      motivo: motivos.get(r.id),
      fichaPet,
    };
  });
}
