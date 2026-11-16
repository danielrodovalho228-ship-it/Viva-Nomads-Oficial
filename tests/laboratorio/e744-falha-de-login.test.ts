/*
  E744 (triagem do t187, ORDEM-DUET-073) — o global-setup diz EM QUE PASSO o login de um papel falhou.
  O t187 falhou num laboratório local com "[global-setup] login de "admin" falhou depois de 3 tentativas", sem dizer
  mais nada; no CI e em outro laboratório local, sobre a mesma main, passa 5 de 5. A mensagem crua era
  "page.waitForURL: Timeout 20000ms exceeded" tanto para senha recusada quanto para o código de duas etapas recusado.
  Reproduzido: com um TESTES_ADMIN_TOTP_SEGREDO que não é o do fator atual da conta (laboratório semeado de novo com
  as variáveis antigas no shell), o erro é exatamente esse. Agora a mensagem diz o passo, a tela e o que a tela disse.
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mensagemDaFalhaDeLogin } from "../e2e/fixtures/falha-de-login.ts";

test("senha: diz o papel, onde a página ficou e o aviso da tela", () => {
  assert.equal(
    mensagemDaFalhaDeLogin({ papel: "admin", etapa: "senha", caminho: "/auth", aviso: "Muitas tentativas. Aguarde 42 s para tentar de novo." }),
    'login de "admin" parou no passo da senha: a página ficou em /auth e a tela disse "Muitas tentativas. Aguarde 42 s para tentar de novo."',
  );
  assert.equal(mensagemDaFalhaDeLogin({ papel: "inquilino", etapa: "senha", caminho: "/auth", aviso: null }), 'login de "inquilino" parou no passo da senha: a página ficou em /auth e a tela não mostrou aviso');
});

test("duas etapas: código recusado aponta para o segredo do ambiente", () => {
  const m = mensagemDaFalhaDeLogin({ papel: "admin", etapa: "duas-etapas", caminho: "/auth/verificar-codigo", aviso: "Código incorreto. Confira o app e tente de novo." });
  assert.match(m, /^login de "admin" parou no passo das duas etapas: a página ficou em \/auth\/verificar-codigo e a tela disse "Código incorreto\. Confira o app e tente de novo\."/);
  assert.match(m, /TESTES_ADMIN_TOTP_SEGREDO deste ambiente não é o do fator atual da conta/);
  assert.match(m, /semeado de novo/);
});

test("o aviso longo é cortado e fica numa linha (o global-setup imprime só a primeira)", () => {
  const m = mensagemDaFalhaDeLogin({ papel: "admin", etapa: "senha", caminho: "/auth", aviso: `linha um\nlinha dois ${"x".repeat(400)}` });
  assert.ok(!m.includes("\n"));
  assert.ok(m.length < 320);
});

test("o login da suíte usa a mensagem nos dois passos", () => {
  const auth = readFileSync("tests/e2e/fixtures/auth.ts", "utf8");
  assert.match(auth, /etapa: "senha"/);
  assert.match(auth, /etapa: "duas-etapas"/);
  // O código recusado é percebido pelo aviso da tela, sem esperar os 20 s do redirecionamento.
  assert.match(auth, /querySelectorAll\('\[role="alert"\]'\)/);
  assert.match(auth, /Promise\.race\(\[entrou, recusou\]\)/);
});

test("no laboratório, o global-setup zera o limite de login de cada persona antes de entrar", () => {
  // O login tem limite progressivo por e-mail (5 por minuto, 10 em 10 minutos, 20 por hora — limite-login.ts). Os specs
  // já zeravam o contador antes de entrar (entrarNaPagina); o global-setup não. Num laboratório reaproveitado, rodadas
  // seguidas estouravam o limite da persona que mais entra (o admin) e a rodada seguia sem a sessão dela.
  const gs = readFileSync("tests/e2e/global-setup.ts", "utf8");
  assert.match(gs, /if \(NO_LABORATORIO\) await liberarLimiteLogin\(account\(role\)\.email\);/);
  assert.ok(gs.indexOf("liberarLimiteLogin(account(role).email)") < gs.indexOf("await loginAs(page, role)"), "antes de cada tentativa de login");
  // Fora do laboratório (prévia, produção) não há chave de serviço: nada é zerado.
  assert.match(gs, /import \{ NO_LABORATORIO, liberarLimiteLogin \} from "\.\/fixtures\/laboratorio";/);
});
