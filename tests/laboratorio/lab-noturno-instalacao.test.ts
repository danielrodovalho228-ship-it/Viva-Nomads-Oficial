import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
 *
 * Decisão do Gerente (DUET-2019): 4 tentativas e teto de 30 min no passo — "runner que não instala em 4 tentativas está
 * quebrado, não lento; 38 min atrasava o veredito da noite inteira".
 *
 * E1037 (ORDEM-DUET-212/213, peça 33): o passo de instalação do Chromium e o do WebKit SAEM do laboratorio.yml — os
 * navegadores e as dependências vêm na imagem oficial do Playwright (lab-imagem-playwright.test.ts). O que este arquivo
 * guarda agora: o passo que baixa a imagem (tentativas com espera, teto curto) e os limites das fatias, que não mudam.
 */
const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");
const passoDaImagem = yml.slice(yml.indexOf("- name: Baixar a imagem do Playwright"), yml.indexOf("- name: Rodar a suíte E2E"));

test("noturno, imagem do Playwright: 3 tentativas de 5 minutos, com espera entre elas, e reprova se nenhuma baixar", () => {
  assert.match(passoDaImagem, /for i in 1 2 3; do\n/);
  assert.match(passoDaImagem, /timeout 300 docker pull mcr\.microsoft\.com\/playwright:v[\d.]+-noble && exit 0\n/);
  assert.match(passoDaImagem, /if \[ "\$i" -lt 3 \]; then sleep 30; fi\n/);
  assert.match(passoDaImagem, /\n {10}done\n {10}exit 1\n/);
  assert.doesNotMatch(passoDaImagem, /continue-on-error/, "sem a imagem a fatia não segue");
  assert.doesNotMatch(yml.slice(yml.indexOf("\n  laboratorio:\n"), yml.indexOf("\n  construir:\n")), /apt-get|dpkg|playwright install/, "nada de apt nas fatias");
});

test("noturno: o passo da imagem tem teto de 15 min, e a fatia geral continua cabendo nos 120 min do job", () => {
  const limiteDoPasso = Number(/timeout-minutes: (\d+)/.exec(passoDaImagem)?.[1]);
  assert.equal(limiteDoPasso, 15);
  // Pior caso do passo: 3 tentativas de 5 min e 2 esperas de 30 s = 16 min… o teto de 15 corta a 3.ª: runner que não baixa
  // a imagem do MCR em 2 tentativas inteiras está quebrado, não lento.
  // Os limites das fatias não mudam (DUET-1949): 120 min do job, 65 min das gerais e da 25, 100 min da quarentena e da varredura.
  const limiteDoJob = Number(/\n {2}laboratorio:\n[\s\S]*?\n {4}timeout-minutes: (\d+)\n/.exec(yml)?.[1]);
  assert.equal(limiteDoJob, 120);
  const globais = [...yml.matchAll(/--global-timeout=(\d+)/g)].map((m) => Number(m[1]));
  assert.deepEqual(globais, [6_000_000, 3_900_000, 3_900_000, 6_000_000]);
  // Fatia geral no pior caso: 5 min de preparo + o passo da imagem + 65 min de testes + 2 min para guardar o resultado.
  const piorFatiaGeral = 5 + limiteDoPasso + 3_900_000 / 60_000 + 2;
  assert.ok(piorFatiaGeral <= limiteDoJob, `a fatia geral no pior caso leva ${piorFatiaGeral} min; o job tem ${limiteDoJob}`);
});
