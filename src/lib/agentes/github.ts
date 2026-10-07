import "server-only";
import { integracoesSimuladas } from "@/lib/integracoes";
import { lerDeploys, lerPrs, type DeployGithub, type PrGithub } from "@/lib/agentes/eventos";

/**
 * PRs e deploys do repositório (público) para a Rede ao vivo. Leitura só, com
 * cache de 5 min (no máximo ~24 chamadas/h). GITHUB_TOKEN é opcional (só sobe o
 * limite da API). No laboratório não chama a rede. Falhou → lista vazia.
 */
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

export async function eventosGithub(): Promise<{ prs: PrGithub[]; deploys: DeployGithub[] }> {
  if (integracoesSimuladas()) return { prs: [], deploys: [] };
  const [prs, deploys] = await Promise.all([
    get("pulls?state=all&sort=updated&direction=desc&per_page=30").then(lerPrs).catch(() => []),
    get("deployments?environment=Production&per_page=10").then(lerDeploys).catch(() => []),
  ]);
  return { prs, deploys };
}
