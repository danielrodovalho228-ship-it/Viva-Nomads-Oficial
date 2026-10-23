import "server-only";
import { MailCheck } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { integracoesSimuladas } from "@/lib/integracoes";
import { TEXTO_VALIDADE_CODIGO } from "@/lib/seguranca/codigo-acesso";
import { ACTION_MODELOS, ARQUIVOS_DOS_MODELOS, NOME_ACTION_MODELOS, lerExecucoes, saudeModelosEmail, ultimaMudancaDosArquivos } from "@/lib/auth/saude-modelos-email";
import { cn } from "@/lib/utils";

const REPO = "danielrodovalho228-ship-it/Viva-Nomads-Oficial";

async function get(caminho: string): Promise<unknown> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const res = await fetch(`https://api.github.com/repos/${REPO}/${caminho}`, {
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Execuções da Action e a última mudança dos modelos na main. No laboratório não chama a rede (sem leitura). */
async function lerSaude() {
  if (integracoesSimuladas()) return saudeModelosEmail(null, null);
  try {
    const [runs, ...commits] = await Promise.all([
      get(`actions/workflows/${ACTION_MODELOS}/runs?per_page=10`),
      ...ARQUIVOS_DOS_MODELOS.map((a) => get(`commits?sha=main&per_page=1&path=${encodeURIComponent(a)}`)),
    ]);
    return saudeModelosEmail(lerExecucoes(runs), ultimaMudancaDosArquivos(commits));
  } catch {
    return saudeModelosEmail(null, null);
  }
}

/**
 * 49-C1 — saúde da entrada por e-mail no /admin: quando os modelos de conta (código, sem link) e a validade do
 * código foram aplicados e conferidos no Supabase pela última vez, e o aviso quando o repositório mudou depois.
 */
export async function CartaoEntradaEmail() {
  const s = await lerSaude();
  const atencao = s.estado === "desatualizado" || s.estado === "nunca" || s.ultimaFalhou;
  return (
    <Panel title="Entrada por e-mail" data-testid="admin-entrada-email" data-estado={s.estado}>
      <p className="mb-3 flex items-center gap-2 text-sm text-ink/70">
        <MailCheck className="h-4 w-4" aria-hidden /> O cadastro e a entrada mandam um e-mail só, com código de 6 dígitos que vale {TEXTO_VALIDADE_CODIGO}.
      </p>
      <ul className="space-y-1 text-sm text-ink">
        <li data-testid="admin-entrada-email-aplicacao">
          Última aplicação conferida no Supabase: {s.ultimaAplicacao ? dataHoraBRT(s.ultimaAplicacao) : "nenhuma registrada"}
        </li>
        <li>Última mudança dos modelos no repositório: {s.ultimaMudanca ? dataHoraBRT(s.ultimaMudanca) : "sem leitura"}</li>
        {s.ultimaFalhou && <li className="text-red-800">A execução mais recente da Action falhou (o Supabase recusou ou a leitura de volta não conferiu).</li>}
      </ul>
      <p
        role={atencao ? "alert" : "status"}
        className={cn("mt-3 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold", atencao ? "text-red-800" : s.estado === "em_dia" ? "text-forest" : "text-ink/70")}
        data-testid="admin-entrada-email-aviso"
      >
        {s.texto}
      </p>
      {atencao && (
        <p className="mt-2 text-xs text-muted">
          GitHub → Actions → &ldquo;{NOME_ACTION_MODELOS}&rdquo; → Run workflow. Ela grava os modelos e a validade do código e lê de volta para conferir.
        </p>
      )}
    </Panel>
  );
}
