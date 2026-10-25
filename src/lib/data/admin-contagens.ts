import "server-only";
/*
  ADMIN-4 — leitura dos números do /admin (uma função por número, usada pela inicial E pela página de destino). Regra
  das contas de teste: a de idsContasTeste (profiles.is_teste, a mesma da 0181). Só o cliente de serviço, depois de o
  layout ter exigido admin.
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { idsContasTeste } from "@/lib/data/admin-indicadores";
import { tipoImovel } from "@/lib/admin/indicadores";
import { contarRealETeste, type Contagem } from "@/lib/admin/contagens";
import { PAPEIS_USUARIOS } from "@/lib/admin/usuarios-lista";

type Admin = SupabaseClient;
type Teste = Set<string>;

/** Estadias ativas: contratos com status ativo; de teste quando o dono ou o morador é conta de teste. */
export async function contarEstadiasAtivas(admin: Admin, teste?: Teste): Promise<Contagem> {
  const [t, { data }] = await Promise.all([teste ?? idsContasTeste(admin), admin.from("contratos").select("tenant_id, properties(owner_id)").eq("status", "ativo").limit(5000)]);
  const linhas = (data ?? []) as unknown as { tenant_id: string | null; properties: { owner_id: string | null } | null }[];
  return contarRealETeste(linhas, (l) => t.has(l.tenant_id ?? "") || t.has(l.properties?.owner_id ?? ""));
}

/** Anúncios publicados: status active; de teste pela regra única dos imóveis (dono de teste ou título [TESTE]). */
export async function contarAnunciosPublicados(admin: Admin, teste?: Teste): Promise<Contagem> {
  const [t, { data }] = await Promise.all([teste ?? idsContasTeste(admin), admin.from("properties").select("id, title, owner_id").eq("status", "active").limit(5000)]);
  const linhas = (data ?? []) as { id: string; title: string | null; owner_id: string }[];
  return contarRealETeste(linhas, (p) => tipoImovel({ id: p.id, titulo: p.title, donoTeste: t.has(p.owner_id) }) === "teste");
}

/** Pedidos de moradia no ar: ativos e ainda não expirados; de teste quando o morador é conta de teste. */
export async function contarPedidosNoAr(admin: Admin, teste?: Teste, agora = new Date()): Promise<Contagem> {
  const [t, { data }] = await Promise.all([
    teste ?? idsContasTeste(admin),
    admin.from("pedidos_moradia").select("inquilino_id").eq("status", "ativo").gt("expira_em", agora.toISOString()).limit(5000),
  ]);
  return contarRealETeste((data ?? []) as { inquilino_id: string | null }[], (p) => t.has(p.inquilino_id ?? ""));
}

/** Chamados abertos: os da fila do Atendimento (sem simulação, nem resolvidos nem encerrados). */
export async function contarChamadosAbertos(admin: Admin, teste?: Teste): Promise<Contagem> {
  const [t, { data }] = await Promise.all([
    teste ?? idsContasTeste(admin),
    admin.from("chamados").select("usuario_id").eq("simulacao", false).not("status", "in", "(resolvido,encerrado)").limit(5000),
  ]);
  return contarRealETeste((data ?? []) as { usuario_id: string | null }[], (c) => t.has(c.usuario_id ?? ""));
}

/** Usuários: proprietários e inquilinos não anonimizados (a regra da lista, PAPEIS_USUARIOS — L-69), em reais e de teste. */
export async function contarUsuarios(admin: Admin): Promise<Contagem> {
  const { data } = await admin.from("profiles").select("is_teste").is("anonymized_at", null).in("role", [...PAPEIS_USUARIOS]).limit(10000);
  return contarRealETeste((data ?? []) as { is_teste: boolean | null }[], (p) => p.is_teste === true);
}

/** E-mails de teste guardados: o total exato (não o tamanho da lista mostrada). */
export async function contarEmailsTeste(admin: Admin): Promise<number> {
  const { count } = await admin.from("emails_teste").select("id", { count: "exact", head: true });
  return count ?? 0;
}

/** Os 4 números da inicial, em paralelo, com UMA leitura das contas de teste. */
export async function numerosDaInicial(admin: Admin, testeLido?: Teste) {
  const teste = testeLido ?? (await idsContasTeste(admin));
  const [estadias, anuncios, pedidos, chamados] = await Promise.all([
    contarEstadiasAtivas(admin, teste),
    contarAnunciosPublicados(admin, teste),
    contarPedidosNoAr(admin, teste),
    contarChamadosAbertos(admin, teste),
  ]);
  return { estadias, anuncios, pedidos, chamados };
}

export interface AtividadeAdmin {
  id: string;
  quando: string;
  texto: string;
  href: string;
}

/**
 * "Atividade recente" da inicial: o que entrou por último (anúncio publicado, contrato, pedido de moradia, chamado),
 * sem dado pessoal (título do anúncio ou cidade). Contas de teste fora. Quatro leituras pequenas em paralelo.
 */
export async function atividadeRecente(admin: Admin, teste?: Teste, n = 8): Promise<AtividadeAdmin[]> {
  const t = teste ?? (await idsContasTeste(admin));
  const [anuncios, contratos, pedidos, chamados] = await Promise.all([
    admin.from("properties").select("id, title, owner_id, created_at").eq("status", "active").order("created_at", { ascending: false }).limit(n),
    admin.from("contratos").select("id, tenant_id, created_at, properties(title, owner_id)").order("created_at", { ascending: false }).limit(n),
    admin.from("pedidos_moradia").select("id, inquilino_id, cidade, criado_em").order("criado_em", { ascending: false }).limit(n),
    admin.from("chamados").select("id, usuario_id, numero_publico, criado_em").eq("simulacao", false).order("criado_em", { ascending: false }).limit(n),
  ]);
  const out: AtividadeAdmin[] = [];
  for (const p of (anuncios.data ?? []) as { id: string; title: string | null; owner_id: string; created_at: string }[]) {
    if (tipoImovel({ id: p.id, titulo: p.title, donoTeste: t.has(p.owner_id) }) === "teste") continue;
    out.push({ id: `a-${p.id}`, quando: p.created_at, texto: `Anúncio publicado: ${p.title ?? "Imóvel"}`, href: `/admin/imoveis?q=${p.id}` });
  }
  for (const c of (contratos.data ?? []) as unknown as { id: string; tenant_id: string | null; created_at: string; properties: { title: string | null; owner_id: string | null } | null }[]) {
    if (t.has(c.tenant_id ?? "") || t.has(c.properties?.owner_id ?? "")) continue;
    out.push({ id: `c-${c.id}`, quando: c.created_at, texto: `Contrato criado: ${c.properties?.title ?? "Imóvel"}`, href: `/admin/contratos/${c.id}` });
  }
  for (const p of (pedidos.data ?? []) as { id: string; inquilino_id: string | null; cidade: string | null; criado_em: string }[]) {
    if (t.has(p.inquilino_id ?? "")) continue;
    out.push({ id: `p-${p.id}`, quando: p.criado_em, texto: `Pedido de moradia${p.cidade ? ` em ${p.cidade}` : ""}`, href: "/admin/pedidos" });
  }
  for (const c of (chamados.data ?? []) as { id: string; usuario_id: string | null; numero_publico: string | null; criado_em: string }[]) {
    if (t.has(c.usuario_id ?? "")) continue;
    out.push({ id: `h-${c.id}`, quando: c.criado_em, texto: `Chamado aberto${c.numero_publico ? ` ${c.numero_publico}` : ""}`, href: `/admin/atendimento/${c.id}` });
  }
  return out.filter((a) => !!a.quando).sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, n);
}
