/*
  Dois defeitos do E798 achados pelo t1660 (E744, passo 9), corrigidos no mesmo PR:
   1. No computador, o proxy mandava /dashboard/conta para /dashboard/conta/perfil SEM a consulta. O link antigo
      /dashboard/conta?linkedin=conectado#confianca chegava a Segurança sem o ?linkedin=…, e o retorno do selo do
      LinkedIn não aparecia. A regra das âncoras antigas é levar a busca junto (secoes.test.ts).
   2. O proxy confia no cookie da largura. Com o cookie dizendo "larga" num aparelho de tela estreita (janela
      estreitada ou tablet girado com o painel fechado), a primeira abertura de /dashboard/conta caía no Perfil; pelo
      E492, no celular /dashboard/conta é o menu da Conta. O proxy agora marca esse redirecionamento, e o Perfil,
      se a tela for estreita, corrige o cookie e volta ao menu.
  Roda: node --test src/lib/conta/e798-consulta-e-largura.test.ts. Na tela: t1660.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COOKIE_VEIO_DA_CONTA, VIDA_VEIO_DA_CONTA_S, redirecionamentoDaConta, voltaAoMenuDaConta } from "./redirecionar-no-servidor.ts";

test("computador: /dashboard/conta vai ao Perfil levando a consulta", () => {
  const larga = (q: string) => redirecionamentoDaConta("/dashboard/conta", new URLSearchParams(q), "larga");
  assert.equal(larga(""), "/dashboard/conta/perfil");
  assert.equal(larga("linkedin=conectado"), "/dashboard/conta/perfil?linkedin=conectado");
  assert.equal(larga("a=1&b=x y"), "/dashboard/conta/perfil?a=1&b=x+y");
  // Celular e 1ª visita seguem sem redirecionar (a página, no navegador, já leva a consulta).
  assert.equal(redirecionamentoDaConta("/dashboard/conta", new URLSearchParams("linkedin=conectado"), "estreita"), null);
  assert.equal(redirecionamentoDaConta("/dashboard/conta", new URLSearchParams("linkedin=conectado"), undefined), null);
});

test("largura desatualizada: só volta ao menu quem veio do redirecionamento e está em tela estreita", () => {
  assert.equal(voltaAoMenuDaConta({ veioDeConta: true, telaLarga: false, search: "" }), "/dashboard/conta");
  assert.equal(voltaAoMenuDaConta({ veioDeConta: true, telaLarga: false, search: "?x=1" }), "/dashboard/conta?x=1");
  assert.equal(voltaAoMenuDaConta({ veioDeConta: true, telaLarga: true, search: "" }), null, "computador de verdade: fica no Perfil");
  assert.equal(voltaAoMenuDaConta({ veioDeConta: false, telaLarga: false, search: "" }), null, "abriu o Perfil direto no celular: fica no Perfil");
});

test("o proxy marca o redirecionamento de /dashboard/conta com um cookie de vida curta, só da Conta", () => {
  assert.equal(COOKIE_VEIO_DA_CONTA, "vn-veio-da-conta");
  assert.ok(VIDA_VEIO_DA_CONTA_S > 0 && VIDA_VEIO_DA_CONTA_S <= 30, "vida curta: só serve para a tela que abre em seguida");
  const proxy = readFileSync("src/proxy.ts", "utf8");
  assert.match(proxy, /if \(marcaVindaDaConta\(pathname\)\)\s*r\.cookies\.set\(COOKIE_VEIO_DA_CONTA, "1", \{ path: "\/dashboard\/conta", maxAge: VIDA_VEIO_DA_CONTA_S, sameSite: "lax" \}\);/);
});

test("o Perfil lê a marca, apaga, e só então decide: âncora antiga primeiro, depois a volta ao menu", () => {
  const c = readFileSync("src/components/account/largura-e-ancora.tsx", "utf8");
  const ancora = c.slice(c.indexOf("export function AncoraAntigaDaConta"));
  assert.match(ancora, /COOKIE_VEIO_DA_CONTA/);
  assert.match(ancora, /max-age=0/, "a marca vale uma vez");
  assert.ok(ancora.indexOf("destinoDaAncora(") < ancora.indexOf("voltaAoMenuDaConta("), "a âncora antiga vence a volta ao menu");
  assert.match(ancora, /`\$\{COOKIE_TELA\}=estreita;/, "antes de voltar, grava a largura certa (senão o proxy mandaria ao Perfil de novo)");
});
