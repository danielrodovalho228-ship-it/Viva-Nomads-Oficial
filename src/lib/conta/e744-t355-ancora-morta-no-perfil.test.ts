/*
  E744 (t355, caso "5. a 1280 px", instável desde o E798): /dashboard/conta#perfil-publico tem de terminar em
  /dashboard/conta/perfil, SEM a âncora — é o que a tabela das âncoras antigas diz (destinoDaAncora: o destino sai "com
  a âncora que ainda existe lá", e "perfil-publico" não existe mais no Perfil).
  Antes dependia de uma corrida: sem o cookie da largura, a página redirecionava para o destino e a âncora sumia; com o
  cookie, o proxy redirecionava, o navegador mantinha a âncora e ninguém a tirava.
  Agora o Perfil tira a âncora morta do endereço. A âncora que ainda existe na tela (pets) fica.
  Roda: node --test src/lib/conta/e744-t355-ancora-morta-no-perfil.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ancoraMortaNoPerfil, destinoDaAncora } from "./secoes.ts";

const RAIZ = new URL("../../../", import.meta.url).pathname;

test("âncora antiga do próprio Perfil sem alvo na tela: sai do endereço", () => {
  assert.equal(ancoraMortaNoPerfil("#perfil-publico"), true);
  assert.equal(destinoDaAncora("#perfil-publico"), "/dashboard/conta/perfil", "o destino da tabela não traz âncora");
});

test("âncora que ainda existe na tela do Perfil (pets) fica", () => {
  assert.equal(ancoraMortaNoPerfil("#pets"), false);
});

test("âncora de outra seção não é assunto do Perfil: quem trata é o redirecionamento (E798)", () => {
  assert.equal(destinoDaAncora("#documento"), "/dashboard/conta/dados#documento");
  assert.equal(ancoraMortaNoPerfil("#documento"), false);
});

test("sem âncora, ou âncora que não é das antigas da Conta: nada a fazer", () => {
  assert.equal(ancoraMortaNoPerfil(""), false);
  assert.equal(ancoraMortaNoPerfil("#qualquer-coisa"), false);
});

test("a lista bate com a tela: o Perfil tem a seção de pets e não tem alvo 'perfil-publico'", () => {
  const telas = ["src/components/account/perfil-tela.tsx", "src/components/account/pets-ficha.tsx", "src/components/account/espelho-papel.tsx"].map((f) => readFileSync(RAIZ + f, "utf8")).join("\n");
  assert.match(telas, /id="pets"/);
  assert.doesNotMatch(telas, /id="perfil-publico"/);
});

test("o Perfil usa a regra e troca o endereço sem recarregar (replaceState), mantendo a busca", () => {
  const fonte = readFileSync(RAIZ + "src/components/account/largura-e-ancora.tsx", "utf8");
  const corpo = fonte.slice(fonte.indexOf("export function AncoraAntigaDaConta"), fonte.indexOf("export function VoltarAoMenuSeTelaEstreita"));
  assert.match(corpo, /ancoraMortaNoPerfil\(/);
  assert.match(corpo, /history\.replaceState\(/);
  assert.match(corpo, /window\.location\.pathname \+ window\.location\.search/);
  // O redirecionamento das outras âncoras (E798) continua igual.
  assert.match(corpo, /if \(destino && !destino\.startsWith\("\/dashboard\/conta\/perfil"\)\) (return )?window\.location\.replace\(destino\)/);
});

test("no Perfil, a volta ao menu (E979) lê a âncora antes de a âncora antiga a tirar", () => {
  const pagina = readFileSync(RAIZ + "src/app/(dashboard)/dashboard/conta/[secao]/page.tsx", "utf8");
  const volta = pagina.indexOf("<VoltarAoMenuSeTelaEstreita />");
  const ancora = pagina.indexOf("<AncoraAntigaDaConta />");
  assert.ok(volta > 0 && ancora > 0);
  assert.ok(volta < ancora, "os efeitos correm na ordem em que os componentes aparecem");
});
