/*
  Decisão de uma aprovação pelo chat do Moacir (ordem 41ae4fc5, parte 2). Sem rede e sem banco aqui:
  tudo entra por `DepsDecidir`, a rota liga as dependências reais e os testes usam um fake.
  Ordem das travas: admin → pendente → prazo → confirmação → login recente → (merge) PR no mesmo commit.
*/
import { hashConfere, podeDecidir, type Aprovacao, type StatusAprovacao, type TipoAprovacao } from "./aprovacoes.ts";

export interface LinhaAprovacao {
  id: string;
  tipo: TipoAprovacao;
  referencia: string;
  status: StatusAprovacao;
  hashConteudo: string | null;
  expiraEm: Date;
}

export interface PrParaMesclar {
  aberto: boolean;
  /** SHA do último commit do PR agora. */
  sha: string;
  semConflito: boolean;
  checksVerdes: boolean;
}

export type ResultadoMescla = "mesclado" | "aguardando_token" | "pr_mudou" | "pr_nao_pronto" | "sem_revisao_moacir" | "falhou";

export interface DepsDecidir {
  agora: Date;
  /** Admin logado (id + último login); null = sem sessão ou não é admin. */
  admin: { id: string; ultimoLoginEm: Date | null } | null;
  carregar(id: string): Promise<LinhaAprovacao | null>;
  /** Grava a decisão só se a linha ainda está 'pendente'. false = alguém decidiu antes (idempotência). */
  gravar(id: string, status: "aprovada" | "recusada", adminId: string, agora: Date): Promise<boolean>;
  /** Marca como expirada uma linha vencida e ainda pendente. */
  expirar(id: string): Promise<void>;
  /** Só existe com GITHUB_MERGE_TOKEN. Sem isto, o merge fica "aguardando". */
  merge?: {
    pr(numero: number): Promise<PrParaMesclar | null>;
    moacirRevisou(numero: number, sha: string): Promise<boolean>;
    mesclar(numero: number, sha: string): Promise<boolean>;
  };
}

export interface RespostaDecisao {
  http: number;
  corpo: { ok: boolean; erro?: string; status?: StatusAprovacao; mescla?: ResultadoMescla };
}

const MENSAGEM: Record<string, string> = {
  nao_admin: "Só admin.",
  ja_decidida: "Esse pedido já foi decidido.",
  expirada: "Esse pedido expirou. Peça um novo cartão.",
  sem_confirmacao: "Toque em Confirmar para aprovar.",
  sessao_antiga: "Entre de novo (login nos últimos 15 minutos) para aprovar.",
};

/** "PR #341" / "#341" / "341" → 341. Qualquer outra coisa → null (nunca mescla por referência estranha). */
export function numeroDoPr(referencia: string): number | null {
  const m = /^\s*(?:PR\s*)?#?(\d{1,6})\s*$/i.exec(referencia);
  return m ? Number(m[1]) : null;
}

/** Texto da revisão do Moacir confirma o PR #N no commit `sha` como APROVADO? */
export function moacirAprovouNoTexto(resumo: string, numero: number, sha: string): boolean {
  const curto = sha.slice(0, 7).toLowerCase();
  const re = new RegExp(`#${numero}\\b[^#]*?${curto}([^#]*?)\\bAPROVADO\\b`, "i");
  const m = curto.length === 7 ? re.exec(resumo) : null;
  // "… AJUSTAR — ainda não APROVADO": a palavra aparece, mas a decisão é contrária.
  return !!m && !/\b(AJUSTAR|BLOQUEADO|REGRESS[ÃA]O|n[ãa]o|nem|sem)\b/i.test(m[1]);
}

async function tentarMesclar(a: LinhaAprovacao, deps: DepsDecidir): Promise<ResultadoMescla> {
  const m = deps.merge;
  if (!m) return "aguardando_token";
  const numero = numeroDoPr(a.referencia);
  if (numero === null || !a.hashConteudo) return "pr_nao_pronto";
  const pr = await m.pr(numero).catch(() => null);
  if (!pr) return "falhou";
  if (!hashConfere(a.hashConteudo, pr.sha)) return "pr_mudou";
  if (!pr.aberto || !pr.semConflito || !pr.checksVerdes) return "pr_nao_pronto";
  if (!(await m.moacirRevisou(numero, pr.sha).catch(() => false))) return "sem_revisao_moacir";
  return (await m.mesclar(numero, pr.sha).catch(() => false)) ? "mesclado" : "falhou";
}

export async function decidirAprovacao(
  deps: DepsDecidir,
  id: string,
  entrada: { acao: unknown; confirmar: unknown },
): Promise<RespostaDecisao> {
  const falha = (http: number, erro: string): RespostaDecisao => ({ http, corpo: { ok: false, erro } });
  if (!deps.admin) return falha(403, MENSAGEM.nao_admin);
  const acao = entrada.acao === "aprovar" || entrada.acao === "recusar" ? entrada.acao : null;
  if (!acao) return falha(400, "Ação inválida.");
  const a = await deps.carregar(id);
  if (!a) return falha(404, "Pedido não encontrado.");

  const aprov: Aprovacao = { tipo: a.tipo, status: a.status, expiraEm: a.expiraEm, hashConteudo: a.hashConteudo };
  const v = podeDecidir(
    aprov,
    { agora: deps.agora, ehAdmin: true, ultimoLoginEm: deps.admin.ultimoLoginEm, confirmou: entrada.confirmar === true },
    acao,
  );
  if (!v.ok) {
    if (v.motivo === "expirada") await deps.expirar(a.id);
    return falha(v.http, MENSAGEM[v.motivo]);
  }

  // PR mudou depois do cartão: não registra aprovação de um commit que o Daniel não viu.
  if (acao === "aprovar" && a.tipo === "merge_pr" && deps.merge) {
    const numero = numeroDoPr(a.referencia);
    const pr = numero === null ? null : await deps.merge.pr(numero).catch(() => null);
    if (pr && !hashConfere(a.hashConteudo, pr.sha)) return falha(409, "O PR mudou depois deste pedido. Peça um novo cartão.");
  }

  const status = acao === "aprovar" ? "aprovada" : "recusada";
  if (!(await deps.gravar(a.id, status, deps.admin.id, deps.agora))) return falha(409, MENSAGEM.ja_decidida);

  const mescla = acao === "aprovar" && a.tipo === "merge_pr" ? await tentarMesclar(a, deps) : undefined;
  return { http: 200, corpo: { ok: true, status, ...(mescla ? { mescla } : {}) } };
}
