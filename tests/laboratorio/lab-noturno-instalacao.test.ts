import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Instalação do Chromium no noturno resistente a falha passageira (ordem do Gerente, DUET-1949, 17/11/2026: o mesmo
 * endurecimento do lab-critico — nova tentativa COM ESPERA — vai também para o laboratorio.yml).
 *
 * O que o noturno já tinha: tentativas curtas com limpeza da trava do dpkg. O que faltava: a espera. Sem ela, uma falha
 * que volta na hora (espelho do apt fora do ar, DNS) gasta as tentativas todas em segundos e a fatia morre sem rodar teste.
 *
 * Medida (40 corridas do laboratorio.yml até 18/11, 815 fatias): o Chromium baixa 21,9 MB de pacotes e nunca esgotou as
 * tentativas; o pior caso foi 5,5 min, em runner a ~80 kB/s, instalando na 2ª tentativa (corrida 44204423221, fatia 14).
 * Os limites das fatias (120 min do job e os --global-timeout) ficam como estão.
 */
const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");
const passoDoChromium = yml.slice(yml.indexOf("- name: Instalar Chromium do Playwright"), yml.indexOf("- name: Instalar WebKit do Playwright"));
const passoDoWebkit = yml.slice(yml.indexOf("- name: Instalar WebKit do Playwright"), yml.indexOf("- name: Rodar a suíte E2E"));
const TENTATIVAS = 5;
const SEGUNDOS_POR_TENTATIVA = 300;
const ESPERA_ENTRE_TENTATIVAS = 30;

test("noturno, instalação do Chromium: 5 tentativas de 5 minutos, com espera entre elas, limpando a trava do apt antes de repetir", () => {
  assert.match(passoDoChromium, /for i in 1 2 3 4 5; do\n/);
  assert.match(passoDoChromium, /timeout 300 npx playwright install --with-deps chromium && exit 0\n/);
  // A limpeza de antes continua: sem ela a tentativa seguinte morre na hora, na trava do dpkg.
  assert.match(passoDoChromium, /sudo pkill -f '\[a\]pt-get\|\[d\]pkg' \|\| true\n/);
  assert.match(passoDoChromium, /sudo fuser \/var\/lib\/dpkg\/lock-frontend \/var\/lib\/dpkg\/lock/);
  assert.match(passoDoChromium, /sudo dpkg --configure -a \|\| true\n/);
  // A espera vem depois da limpeza e não acontece depois da última tentativa.
  assert.match(passoDoChromium, /if \[ "\$i" -lt 5 \]; then sleep 30; fi\n/);
  assert.ok(passoDoChromium.indexOf("dpkg --configure -a") < passoDoChromium.indexOf("sleep 30"), "espera depois da limpeza");
  // Se nenhuma tentativa instalar, o passo reprova: a fatia não segue sem o Chromium.
  assert.match(passoDoChromium, /\n {10}done\n {10}exit 1\n/);
  assert.doesNotMatch(passoDoChromium, /continue-on-error/);
});

test("noturno, instalação do Chromium: o passo comporta as 5 tentativas e a fatia geral continua cabendo nos 120 min do job", () => {
  const limiteDoPasso = Number(/timeout-minutes: (\d+)/.exec(passoDoChromium)?.[1]);
  // Pior caso do passo: 5 tentativas, 4 esperas e, em cada tentativa, até 2 minutos à espera da trava do dpkg.
  const piorCaso = TENTATIVAS * SEGUNDOS_POR_TENTATIVA + (TENTATIVAS - 1) * ESPERA_ENTRE_TENTATIVAS + TENTATIVAS * 40 * 3;
  assert.ok(limiteDoPasso * 60 >= piorCaso, `o passo tem ${limiteDoPasso} min; o pior caso leva ${Math.ceil(piorCaso / 60)}`);

  // Os limites das fatias não mudam (DUET-1949): 120 min do job, 65 min das gerais e da 25, 100 min da quarentena e da varredura.
  const limiteDoJob = Number(/\n {2}laboratorio:\n[\s\S]*?\n {4}timeout-minutes: (\d+)\n/.exec(yml)?.[1]);
  assert.equal(limiteDoJob, 120);
  const globais = [...yml.matchAll(/--global-timeout=(\d+)/g)].map((m) => Number(m[1]));
  assert.deepEqual(globais, [6_000_000, 3_900_000, 3_900_000, 6_000_000]);
  const limiteDoWebkit = Number(/timeout-minutes: (\d+)/.exec(passoDoWebkit)?.[1]);
  assert.equal(limiteDoWebkit, 10);

  // Fatia geral, tudo no pior caso: 5 min de preparo (medido: até 4,6) + Chromium + WebKit + 65 min de testes + 2 min
  // para guardar o resultado (medido: até 0,4).
  const piorFatiaGeral = 5 + limiteDoPasso + limiteDoWebkit + 3_900_000 / 60_000 + 2;
  assert.ok(piorFatiaGeral <= limiteDoJob, `a fatia geral no pior caso leva ${piorFatiaGeral} min; o job tem ${limiteDoJob}`);
});

/** Roda o script do passo com comandos de mentira: o `npx` falha nas primeiras `falhas` chamadas e depois instala. */
function rodarInstalacao(falhas: number) {
  const script = passoDoChromium.slice(passoDoChromium.indexOf("run: |\n") + 7).split("\n").map((l) => l.replace(/^ {10}/, "")).join("\n");
  const dir = mkdtempSync(join(tmpdir(), "lab-noturno-instalacao-"));
  const cmd = (nome: string, corpo: string) => {
    writeFileSync(join(dir, nome), `#!/bin/bash\n${corpo}\n`);
    chmodSync(join(dir, nome), 0o755);
  };
  cmd("npx", `n=$(cat "${dir}/chamadas" 2>/dev/null || echo 0); n=$((n + 1)); echo $n > "${dir}/chamadas"; echo "npx $*" >> "${dir}/log"; [ "$n" -gt ${falhas} ]`);
  cmd("timeout", `echo "timeout $1" >> "${dir}/log"; shift; exec "$@"`);
  cmd("sudo", `exec "$@"`);
  cmd("pkill", `echo "pkill" >> "${dir}/log"; exit 0`);
  cmd("fuser", `exit 1`); // trava livre
  cmd("dpkg", `echo "dpkg $*" >> "${dir}/log"; exit 0`);
  cmd("sleep", `echo "sleep $1" >> "${dir}/log"; exit 0`);
  writeFileSync(join(dir, "passo.sh"), script);
  const r = spawnSync("bash", ["-e", join(dir, "passo.sh")], { env: { ...process.env, PATH: `${dir}:/usr/bin:/bin` }, encoding: "utf8" });
  const log = existsSync(join(dir, "log")) ? readFileSync(join(dir, "log"), "utf8").trim().split("\n") : [];
  return { saida: r.status, texto: r.stdout, log };
}

test("noturno, instalação do Chromium, rodando o passo de verdade: espera depois de cada falha, instala na tentativa seguinte e desiste na 5ª com saída 1", () => {
  // Falha que volta na hora, duas vezes seguidas: antes as tentativas saíam coladas; agora há 30 s entre elas.
  const terceira = rodarInstalacao(2);
  assert.equal(terceira.saida, 0);
  assert.deepEqual(terceira.texto.trim().split("\n"), ["tentativa 1 travou ou falhou", "tentativa 2 travou ou falhou"]);
  assert.equal(terceira.log.filter((l) => l.startsWith("npx playwright install --with-deps chromium")).length, 3);
  assert.equal(terceira.log.filter((l) => l === "timeout 300").length, 3);
  assert.equal(terceira.log.filter((l) => l === "sleep 30").length, 2, "uma espera depois de cada falha");
  assert.equal(terceira.log.filter((l) => l === "pkill").length, 2, "limpa o apt que sobrou depois de cada falha");
  // A ordem dentro de uma falha: limpa, conserta o dpkg e só então espera.
  const depoisDaPrimeira = terceira.log.slice(terceira.log.indexOf("pkill"), terceira.log.indexOf("sleep 30") + 1);
  assert.deepEqual(depoisDaPrimeira, ["pkill", "dpkg --configure -a", "sleep 30"]);
  // Runner bom: instala de primeira, sem espera nenhuma.
  const primeira = rodarInstalacao(0);
  assert.equal(primeira.saida, 0);
  assert.equal(primeira.log.filter((l) => l.startsWith("sleep")).length, 0);
  // Nunca instala: cinco tentativas, quatro esperas (nenhuma depois da última) e o passo reprova.
  const nunca = rodarInstalacao(99);
  assert.equal(nunca.saida, 1);
  assert.equal(nunca.log.filter((l) => l.startsWith("npx")).length, 5);
  assert.equal(nunca.log.filter((l) => l === "sleep 30").length, 4);
  assert.match(nunca.texto, /tentativa 5 travou ou falhou/);
});

test("noturno: o WebKit segue em passo próprio que não derruba a fatia", () => {
  // Este PR não mexe no WebKit (117 MB de pacotes; em runner lento as 2 tentativas de 4 min não bastam — ver o corpo do PR).
  assert.match(passoDoWebkit, /continue-on-error: true/);
  assert.match(passoDoWebkit, /timeout 240 npx playwright install --with-deps webkit && exit 0\n/);
});
