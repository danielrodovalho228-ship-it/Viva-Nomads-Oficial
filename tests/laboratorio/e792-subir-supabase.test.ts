/*
  E792 — o "Subir o Supabase local" caía quando a porta 54322 ficava presa na VM do runner ("failed to bind host port
  0.0.0.0:54322/tcp: address already in use", runs 42536824482, 42538098625, 42682752738 — as 3 tentativas na mesma
  porta falhavam, sem ninguém escutando nela). scripts/lab/subir-supabase.sh troca o banco para uma porta livre quando o
  erro é o bind da porta do banco, e grava LAB_DB_URL; os workflows usam o script e os psql leem LAB_DB_URL.
  Teste com um `supabase` FALSO (o erro é o texto real do log). Roda: node --test tests/laboratorio/e792-subir-supabase.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ERRO_REAL =
  'failed to start docker container "supabase_db_viva-nomads-lab": Error response from daemon: failed to set up container networking: driver failed programming external connectivity on endpoint supabase_db_viva-nomads-lab (db3c1fc583858d32): failed to bind host port 0.0.0.0:54322/tcp: address already in use';

/** Monta um diretório com o config.toml real e um `supabase` falso; `regra` decide o resultado do `start`. */
function cenario(regra: "porta-54322-presa" | "sempre-ok" | "outra-falha") {
  const dir = mkdtempSync(join(tmpdir(), "e792-"));
  const config = join(dir, "config.toml");
  copyFileSync("supabase/config.toml", config);
  const falso = join(dir, "supabase");
  const corpo =
    regra === "sempre-ok"
      ? `[ "$1" = start ] && echo "Started supabase local development setup."; exit 0`
      : regra === "outra-falha"
        ? `[ "$1" = start ] && { echo "Error: something else broke"; exit 1; }; exit 0`
        : `if [ "$1" = start ]; then p=$(awk '/^\\[db\\]/{d=1;next} /^\\[/{d=0} d&&/^port/{gsub(/[^0-9]/,"");print;exit}' "${config}"); if [ "$p" = 54322 ]; then echo '${ERRO_REAL}'; exit 1; fi; echo "Started (db $p)"; fi; exit 0`;
  writeFileSync(falso, `#!/usr/bin/env bash\n${corpo}\n`);
  chmodSync(falso, 0o755);
  const env = join(dir, "github_env");
  writeFileSync(env, "");
  const r = spawnSync("bash", ["scripts/lab/subir-supabase.sh", "3"], {
    env: { ...process.env, SUPABASE_BIN: falso, SUPABASE_CONFIG: config, LAB_SEM_DOCKER: "1", GITHUB_ENV: env },
    encoding: "utf8",
  });
  return { codigo: r.status, saida: r.stdout + r.stderr, env: readFileSync(env, "utf8"), config: readFileSync(config, "utf8") };
}
const portaDb = (toml: string) => toml.slice(toml.indexOf("[db]")).match(/^port = (\d+)/m)?.[1];

test("porta 54322 presa (o erro real do log): o banco sobe na 55322 e LAB_DB_URL aponta para ela", () => {
  const r = cenario("porta-54322-presa");
  assert.equal(r.codigo, 0, r.saida);
  assert.match(r.saida, /porta 54322 do banco está presa nesta máquina; o banco sobe na 55322/);
  assert.equal(r.env.trim(), "LAB_DB_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres");
  assert.equal(portaDb(r.config), "55322");
  assert.match(r.config, /^shadow_port = 54320$/m, "só a porta do banco muda");
  assert.match(r.config, /^\[api\][\s\S]*?^port = 54321$/m, "a API segue na 54321");
});

test("máquina sadia: sobe na 54322 de primeira e nada muda", () => {
  const r = cenario("sempre-ok");
  assert.equal(r.codigo, 0, r.saida);
  assert.equal(r.env.trim(), "LAB_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres");
  assert.equal(portaDb(r.config), "54322");
});

test("outra falha (não é o bind): não troca a porta à toa e termina vermelho depois das tentativas", () => {
  const r = cenario("outra-falha");
  assert.equal(r.codigo, 1);
  assert.match(r.saida, /::error::supabase start falhou 3 vezes/);
  assert.equal(portaDb(r.config), "54322");
  assert.equal(r.env, "");
});

test("os 4 jobs que sobem o Supabase usam o script, e nenhum psql do workflow fixa a 54322", () => {
  const jobs = { "lab-critico": 1, laboratorio: 2, "linhas-de-base": 1 } as const;
  for (const [wf, n] of Object.entries(jobs)) {
    const y = readFileSync(`.github/workflows/${wf}.yml`, "utf8");
    assert.equal((y.match(/run: scripts\/lab\/subir-supabase\.sh/g) ?? []).length, n, wf);
    assert.doesNotMatch(y, /supabase start -x/, `${wf}: start fora do script`);
    assert.doesNotMatch(y, /psql "postgresql:\/\/postgres:postgres@127\.0\.0\.1:54322/, `${wf}: psql com a porta fixa`);
    assert.match(y, /psql "\$LAB_DB_URL"/, wf);
  }
});
