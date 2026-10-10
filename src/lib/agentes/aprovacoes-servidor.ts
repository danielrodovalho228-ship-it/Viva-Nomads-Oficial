import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { moacirAprovouNoTexto, type DepsDecidir, type LinhaAprovacao, type PrParaMesclar } from "@/lib/agentes/decidir-aprovacao";
import type { CartaoAprovacao, StatusAprovacao, TipoAprovacao } from "@/lib/agentes/aprovacoes";

/**
 * Dependências REAIS da decisão de aprovações. A sessão (cookie) decide QUEM é admin;
 * a gravação usa service_role só neste arquivo (a tabela só deixa o admin LER) e só depois da checagem.
 * O token do merge (GITHUB_MERGE_TOKEN, fine-grained, só este repo) nunca sai do servidor nem entra em log.
 */
const REPO = "danielrodovalho228-ship-it/Viva-Nomads-Oficial";

async function gh(caminho: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.github.com/repos/${REPO}/${caminho}`, {
    ...init,
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
}

function mesclaReal(token: string, revisoes: () => Promise<string[]>): NonNullable<DepsDecidir["merge"]> {
  return {
    async pr(numero): Promise<PrParaMesclar | null> {
      const res = await gh(`pulls/${numero}`, token);
      if (!res.ok) return null;
      const p = (await res.json()) as { state?: string; mergeable?: boolean | null; mergeable_state?: string; head?: { sha?: string } };
      const sha = p.head?.sha ?? "";
      if (!sha) return null;
      const cr = await gh(`commits/${sha}/check-runs?per_page=100`, token);
      const checks = cr.ok ? ((await cr.json()) as { check_runs?: { status?: string; conclusion?: string | null }[] }).check_runs ?? [] : [];
      const verdes = checks.length > 0 && checks.every((c) => c.status === "completed" && ["success", "skipped", "neutral"].includes(c.conclusion ?? ""));
      return { aberto: p.state === "open", sha, semConflito: p.mergeable === true && p.mergeable_state !== "dirty", checksVerdes: verdes };
    },
    async moacirRevisou(numero, sha) {
      return (await revisoes()).some((r) => moacirAprovouNoTexto(r, numero, sha));
    },
    async mesclar(numero, sha) {
      // `sha` faz o GitHub recusar se entrou commit novo entre a checagem e a mescla.
      const res = await gh(`pulls/${numero}/merge`, token, { method: "PUT", body: JSON.stringify({ merge_method: "merge", sha }), headers: { "Content-Type": "application/json" } });
      return res.ok;
    },
  };
}

export async function depsDecidirReais(): Promise<DepsDecidir> {
  const agora = new Date();
  const sessao = await createClient();
  const admin = createAdminClient();
  const vazio = { agora, admin: null, carregar: async () => null, gravar: async () => false, expirar: async () => {} } satisfies DepsDecidir;
  if (!sessao || !admin) return vazio;
  const {
    data: { user },
  } = await sessao.auth.getUser();
  if (!user || !(await ehAdmin(sessao, user.id))) return vazio;

  const token = process.env.GITHUB_MERGE_TOKEN?.trim();
  const revisoes = async () => {
    const { data } = await admin.from("agentes_rondas").select("resumo").eq("agente_slug", "moacir").like("resumo", "Revisão de PRs%").order("iniciada_em", { ascending: false }).limit(5);
    return (data ?? []).map((r) => String((r as { resumo?: string }).resumo ?? ""));
  };

  return {
    agora,
    admin: { id: user.id, ultimoLoginEm: user.last_sign_in_at ? new Date(user.last_sign_in_at) : null },
    async carregar(id): Promise<LinhaAprovacao | null> {
      const { data } = await admin.from("aprovacoes").select("id, tipo, referencia, status, hash_conteudo, expira_em").eq("id", id).maybeSingle();
      if (!data) return null;
      const d = data as { id: string; tipo: TipoAprovacao; referencia: string; status: StatusAprovacao; hash_conteudo: string | null; expira_em: string };
      return { id: d.id, tipo: d.tipo, referencia: d.referencia, status: d.status, hashConteudo: d.hash_conteudo, expiraEm: new Date(d.expira_em) };
    },
    async gravar(id, status, adminId, quando) {
      const { data } = await admin.from("aprovacoes").update({ status, decidido_por: adminId, decidido_em: quando.toISOString() }).eq("id", id).eq("status", "pendente").select("id");
      return (data?.length ?? 0) === 1;
    },
    async expirar(id) {
      await admin.from("aprovacoes").update({ status: "expirada" }).eq("id", id).eq("status", "pendente");
    },
    merge: token ? mesclaReal(token, revisoes) : undefined,
  };
}

/**
 * Pedidos pendentes e dentro do prazo, para os cartões do chat. Usa a SESSÃO (a RLS "admin lê" decide);
 * quem não é admin recebe lista vazia, sem erro que revele a tabela.
 */
export async function listarPendentesAdmin(sessao: NonNullable<Awaited<ReturnType<typeof createClient>>>): Promise<CartaoAprovacao[]> {
  const { data } = await sessao
    .from("aprovacoes")
    .select("id, tipo, referencia, resumo, risco, expira_em")
    .eq("status", "pendente")
    .gt("expira_em", new Date().toISOString())
    .order("criado_em", { ascending: false })
    .limit(20);
  return (data ?? []).map((d) => {
    const r = d as { id: string; tipo: TipoAprovacao; referencia: string; resumo: string; risco: CartaoAprovacao["risco"]; expira_em: string };
    return { id: r.id, tipo: r.tipo, referencia: r.referencia, resumo: r.resumo, risco: r.risco, expiraEm: r.expira_em };
  });
}
