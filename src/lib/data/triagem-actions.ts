"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { logModeracao } from "@/lib/data/moderacao-log";
import { primeiroNome } from "@/lib/display-name";
import { tipoVisualizacaoDoc, type VisualizacaoDoc } from "@/lib/moderacao-doc";
import { triagemVinculoAtiva } from "@/lib/triagem/chave";
import {
  BUCKET_TRIAGEM,
  TIPOS_VINCULO,
  ehMotivoRecusa,
  estadoVinculo,
  metricasTriagem,
  textoDaRecusa,
  validoAte,
  type EstadoVinculo,
  type LinhaVinculo,
} from "@/lib/triagem/vinculo";

/*
  Prompt 52 — triagem do morador (vínculo). Tudo atrás da chave TRIAGEM_VINCULO_ATIVA: desligada, cada ação devolve nada.
  O morador vê o próprio estado e abre o próprio arquivo; a equipe (admin com 2FA) confere e decide. O dono NUNCA abre o
  arquivo: na candidatura ele recebe só o texto do selo (src/lib/data/leads.ts).
*/

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_TTL = 60 * 10;
const COLUNAS = "id, user_id, tipo, status, motivo, decidido_em, valido_ate, enviado_em";

type Linha = LinhaVinculo & { id: string; user_id: string };

async function sessao() {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, admin, userId: user.id } : null;
}

export interface MeuVinculo {
  estado: EstadoVinculo;
  tipo: string | null;
  motivo: string | null;
  validoAte: string | null;
  enviadoEm: string | null;
  /** Candidatura aceita: o degrau em que o comprovante é pedido. */
  noDegrau: boolean;
}

export async function meuVinculo(): Promise<MeuVinculo | null> {
  if (!(await triagemVinculoAtiva())) return null;
  const s = await sessao();
  if (!s) return null;
  const [{ data }, { data: aceitas }] = await Promise.all([
    s.admin.from("triagem_vinculos").select(COLUNAS).eq("user_id", s.userId).order("enviado_em", { ascending: false }).limit(1).maybeSingle(),
    s.admin.from("leads").select("id").eq("tenant_id", s.userId).eq("status", "accepted").limit(1),
  ]);
  const l = (data as Linha | null) ?? null;
  return {
    estado: estadoVinculo(l, new Date()),
    tipo: l?.tipo ?? null,
    motivo: l?.status === "recusado" ? l.motivo : null,
    validoAte: l?.status === "aprovado" ? l.valido_ate : null,
    enviadoEm: l?.enviado_em ?? null,
    noDegrau: !!aceitas?.length,
  };
}

/** O próprio morador abre o arquivo que enviou (link de 10 min). */
export async function linkMeuVinculo(): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!(await triagemVinculoAtiva())) return { ok: false, error: "Indisponível." };
  const s = await sessao();
  if (!s) return { ok: false, error: "Entre para abrir." };
  const { data } = await s.admin.from("triagem_vinculos").select("path").eq("user_id", s.userId).order("enviado_em", { ascending: false }).limit(1).maybeSingle();
  if (!data?.path) return { ok: false, error: "Nenhum comprovante enviado." };
  const { data: u } = await s.admin.storage.from(BUCKET_TRIAGEM).createSignedUrl(data.path as string, LINK_TTL);
  return u?.signedUrl ? { ok: true, url: u.signedUrl } : { ok: false, error: "Não foi possível abrir agora." };
}

// ── Equipe (admin com 2FA) ─────────────────────────────────────────────────────────────────────────────────────

async function equipe() {
  const s = await sessao();
  if (!s || !(await ehAdmin(s.supabase, s.userId))) return null;
  return s;
}

export interface VinculoPendente {
  id: string;
  nome: string;
  nomeCompleto: string | null;
  tipo: string;
  tipoTitulo: string;
  enviadoEm: string;
  docUrl: string | null;
  docTipo: VisualizacaoDoc;
  teste: boolean;
}

export async function listarVinculosPendentes(): Promise<{ itens: VinculoPendente[]; metricas: { pendentes: number; aprovados: number; recusados: number } } | null> {
  if (!(await triagemVinculoAtiva())) return null;
  const s = await equipe();
  if (!s) return null;
  const [{ data: pend }, { data: todas }] = await Promise.all([
    s.admin.from("triagem_vinculos").select(`${COLUNAS}, path`).eq("status", "pendente").order("enviado_em").limit(100),
    s.admin.from("triagem_vinculos").select("user_id, status").limit(5000),
  ]);
  const linhas = (pend ?? []) as (Linha & { path: string })[];
  const ids = [...new Set([...linhas.map((l) => l.user_id), ...((todas ?? []) as { user_id: string }[]).map((l) => l.user_id)])];
  const { data: perfis } = ids.length ? await s.admin.from("profiles").select("id, full_name, is_teste").in("id", ids) : { data: [] };
  const p = new Map(((perfis ?? []) as { id: string; full_name: string | null; is_teste: boolean | null }[]).map((x) => [x.id, x]));
  const testes = new Set([...p.values()].filter((x) => x.is_teste).map((x) => x.id));
  const itens = await Promise.all(
    linhas.map(async (l) => {
      const { data: u } = await s.admin.storage.from(BUCKET_TRIAGEM).createSignedUrl(l.path, LINK_TTL);
      const perfil = p.get(l.user_id);
      return {
        id: l.id,
        nome: primeiroNome(perfil?.full_name ?? "") || "Morador",
        nomeCompleto: perfil?.full_name ?? null,
        tipo: l.tipo,
        tipoTitulo: TIPOS_VINCULO.find((t) => t.tipo === l.tipo)?.titulo ?? l.tipo,
        enviadoEm: l.enviado_em,
        docUrl: u?.signedUrl ?? null,
        docTipo: tipoVisualizacaoDoc(l.path),
        teste: testes.has(l.user_id),
      };
    }),
  );
  return { itens, metricas: metricasTriagem((todas ?? []) as { user_id: string; status: string }[], testes) };
}

/** Link novo de 10 min para a equipe (o da lista expira). */
export async function linkVinculoAdmin(id: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!(await triagemVinculoAtiva())) return { ok: false, error: "Indisponível." };
  const s = await sessao();
  if (!s || !(await ehAdmin(s.supabase, s.userId)) || !UUID.test(String(id))) return { ok: false, error: "Sem permissão." };
  const { data } = await s.admin.from("triagem_vinculos").select("path").eq("id", id).maybeSingle();
  if (!data?.path) return { ok: false, error: "Não encontrado." };
  const { data: u } = await s.admin.storage.from(BUCKET_TRIAGEM).createSignedUrl(data.path as string, LINK_TTL);
  return u?.signedUrl ? { ok: true, url: u.signedUrl } : { ok: false, error: "Não foi possível abrir agora." };
}

export async function decidirVinculo(id: string, decisao: "aprovar" | "recusar", motivo?: string | null, complemento?: string | null): Promise<{ ok: boolean; error?: string }> {
  if (!(await triagemVinculoAtiva())) return { ok: false, error: "Indisponível." };
  const s = await sessao();
  if (!s || !(await ehAdmin(s.supabase, s.userId))) return { ok: false, error: "Só a equipe, com a verificação em duas etapas." };
  if (!UUID.test(String(id))) return { ok: false, error: "Envio inválido." };
  const agora = new Date();
  let mudanca: Record<string, unknown>;
  if (decisao === "aprovar") mudanca = { status: "aprovado", motivo: null, decidido_por: s.userId, decidido_em: agora.toISOString(), valido_ate: validoAte(agora) };
  else {
    if (!ehMotivoRecusa(motivo)) return { ok: false, error: "Escolha o motivo da recusa: o morador lê e corrige na hora." };
    mudanca = { status: "recusado", motivo: textoDaRecusa(motivo, complemento), decidido_por: s.userId, decidido_em: agora.toISOString(), valido_ate: null };
  }
  const { data, error } = await s.admin.from("triagem_vinculos").update(mudanca).eq("id", id).eq("status", "pendente").select("user_id");
  if (error || !data?.length) return { ok: false, error: "Este envio já foi decidido ou foi trocado pelo morador." };
  await logModeracao(s.supabase, s.userId, decisao === "aprovar" ? "aprovar_vinculo" : "recusar_vinculo", "triagem_vinculo", id);
  revalidatePath("/admin/documentos");
  revalidatePath("/dashboard/candidaturas");
  return { ok: true };
}
