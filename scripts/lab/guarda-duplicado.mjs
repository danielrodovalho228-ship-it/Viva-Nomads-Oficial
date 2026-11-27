/*
  Peça 25 / ORDEM-DUET-207 — guarda contra a corrida AGENDADA duplicada do laboratorio.yml.
  O agendador do GitHub atrasa 7–10 h todos os crons do repositório; com o disparo manual como procedimento (ORDEM-189), a
  agendada atrasada chegava horas depois e corria em paralelo com a manual, no mesmo commit, com o dobro dos jobs e duas
  linhas no histórico. Regra: uma corrida `schedule` termina coberta (verde, sem fatias, sem banco) se já houver outra
  corrida do laboratorio.yml na main, não cancelada, criada nas últimas JANELA_HORAS. Manual e push nunca são barrados.
  Uso no workflow (job `guarda`): node scripts/lab/guarda-duplicado.mjs  → escreve `coberta=true|false` em $GITHUB_OUTPUT.
*/
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

export const JANELA_HORAS = 6;

/** Puro. `corridas`: as do laboratorio.yml na main (a API devolve as mais novas primeiro); inclui esta. */
export function decidirGuarda({ evento, estaCorrida, corridas, agora }) {
  if (evento !== "schedule") return { coberta: false, por: null };
  const limite = agora.getTime() - JANELA_HORAS * 3_600_000;
  const outra = corridas
    .filter((c) => Number(c.id) !== Number(estaCorrida))
    .filter((c) => c.conclusion !== "cancelled")
    .filter((c) => Date.parse(c.created_at) >= limite && Date.parse(c.created_at) <= agora.getTime())
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  return outra ? { coberta: true, por: Number(outra.id) } : { coberta: false, por: null };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const evento = process.env.GITHUB_EVENT_NAME ?? "";
  const estaCorrida = Number(process.env.GITHUB_RUN_ID ?? 0);
  let decisao = { coberta: false, por: null };
  if (evento === "schedule") {
    try {
      const json = execFileSync("gh", ["api", `repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/laboratorio.yml/runs?branch=main&per_page=30`], { encoding: "utf8" });
      decisao = decidirGuarda({ evento, estaCorrida, corridas: JSON.parse(json).workflow_runs ?? [], agora: new Date() });
    } catch (e) {
      // Sem conseguir ler as corridas, a agendada CORRE (nunca se perde uma rodada por falha da guarda).
      console.log(`::warning title=Guarda do agendado::não consegui ler as corridas (${String(e?.message ?? e).slice(0, 200)}); a corrida segue.`);
    }
  }
  if (decisao.coberta) console.log(`::notice title=Agendada coberta::coberta pela corrida ${decisao.por} (nas últimas ${JANELA_HORAS} h): esta agendada não roda a suíte nem grava no banco.`);
  else console.log(`guarda: ${evento} — segue (nenhuma corrida da main nas últimas ${JANELA_HORAS} h, ou evento que nunca é barrado).`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `coberta=${decisao.coberta}\npor=${decisao.por ?? ""}\n`);
}
