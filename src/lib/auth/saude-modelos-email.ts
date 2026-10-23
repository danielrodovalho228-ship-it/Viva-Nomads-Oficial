/*
  49-C1 — os modelos de e-mail de conta em produção estão em dia? PURO. Os modelos (assunto, corpo, remetente e
  validade do código) só chegam ao Supabase pela Action manual "Aplicar e-mails de conta no Supabase", que grava e lê
  de volta (o script sai com erro se a leitura não conferir). O /admin compara a última execução da Action com a
  última mudança, na main, de um dos arquivos que montam esses modelos: mudou depois da última aplicação → aviso.
*/

/** Arquivos que mudam o que vai para o Supabase (corpoConfigAuth). */
export const ARQUIVOS_DOS_MODELOS = [
  "src/lib/notifications/templates-supabase.ts",
  "src/lib/notifications/supabase-auth-config.ts",
  "src/lib/notifications/modelo-email.ts",
  "src/lib/notifications/remetente.ts",
  "src/lib/seguranca/codigo-acesso.ts",
] as const;

export const ACTION_MODELOS = "aplicar-emails-supabase.yml";
export const NOME_ACTION_MODELOS = "Aplicar e-mails de conta no Supabase";
export const AVISO_DESATUALIZADO = "Modelos de e-mail desatualizados no Supabase: rode a Action.";

export interface ExecucaoAction {
  em: string;
  /** Terminou com sucesso: gravou E a leitura de volta conferiu. */
  ok: boolean;
  /** Ainda rodando (sem resultado). */
  rodando?: boolean;
}

export type EstadoModelos = "em_dia" | "desatualizado" | "nunca" | "sem_leitura";

export interface SaudeModelos {
  estado: EstadoModelos;
  ultimaAplicacao: string | null;
  ultimaMudanca: string | null;
  /** A execução mais recente falhou (o Supabase recusou ou a leitura de volta não conferiu). */
  ultimaFalhou: boolean;
  texto: string;
}

/** `execucoes` da mais nova para a mais antiga; null = não deu para ler (sem rede, laboratório). */
export function saudeModelosEmail(execucoes: ExecucaoAction[] | null, ultimaMudanca: string | null): SaudeModelos {
  if (!execucoes) return { estado: "sem_leitura", ultimaAplicacao: null, ultimaMudanca, ultimaFalhou: false, texto: "Não foi possível ler as execuções da Action agora." };
  const terminadas = execucoes.filter((e) => !e.rodando);
  const ultimaOk = terminadas.find((e) => e.ok) ?? null;
  const ultimaFalhou = !!terminadas[0] && !terminadas[0].ok;
  if (!ultimaOk) return { estado: "nunca", ultimaAplicacao: null, ultimaMudanca, ultimaFalhou, texto: `A Action nunca terminou com a leitura conferida. ${AVISO_DESATUALIZADO}` };
  const desatualizado = !!ultimaMudanca && Date.parse(ultimaMudanca) > Date.parse(ultimaOk.em);
  return {
    estado: desatualizado ? "desatualizado" : "em_dia",
    ultimaAplicacao: ultimaOk.em,
    ultimaMudanca,
    ultimaFalhou,
    texto: desatualizado ? AVISO_DESATUALIZADO : "Modelos aplicados e conferidos depois da última mudança no repositório.",
  };
}

/** Lê a resposta da API do GitHub (workflow_runs) sem confiar no formato. */
export function lerExecucoes(json: unknown): ExecucaoAction[] {
  const runs = (json as { workflow_runs?: unknown })?.workflow_runs;
  if (!Array.isArray(runs)) return [];
  return runs
    .map((r) => r as { created_at?: unknown; status?: unknown; conclusion?: unknown })
    .filter((r) => typeof r.created_at === "string")
    .map((r) => ({ em: r.created_at as string, ok: r.conclusion === "success", rodando: r.status !== "completed" }))
    .sort((a, b) => Date.parse(b.em) - Date.parse(a.em));
}

/** Data do commit mais novo entre os arquivos (respostas de /commits?path=…&per_page=1). */
export function ultimaMudancaDosArquivos(respostas: unknown[]): string | null {
  const datas = respostas
    .map((r) => (Array.isArray(r) ? (r[0] as { commit?: { committer?: { date?: unknown } } } | undefined)?.commit?.committer?.date : null))
    .filter((d): d is string => typeof d === "string" && !Number.isNaN(Date.parse(d)));
  return datas.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}
