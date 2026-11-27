/*
  E1136 (ORDENS-DUET 594 e 599; resíduos do E1134): a Caixa de e-mails de teste (Conta › Ajuda).
   1. SILÊNCIO DUPLO. A tela só mostrava "carregando" e o erro a quem a sessão do navegador já sabia ser conta de teste.
      Se o perfil da sessão não fosse lido (vira "conta real") e a busca da caixa também falhasse, a caixa não aparecia.
      Agora a página diz, do servidor, se a conta é de teste; a sessão do navegador só decide quando o servidor não leu.
   2. LIMITE DE TEMPO. A busca que nunca respondia ficava em "Carregando os e-mails…" para sempre, sem botão. Agora, aos
      5 s, o carregamento diz que está demorando e ganha "Tentar de novo"; aos 15 s a busca é cortada e vira "não li".
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAIXA_DEMORA_MS, CAIXA_LIMITE_MS, TEXTO_CAIXA_DEMORADA, contaDeTesteSabida, vistaDaCaixa } from "./caixa-teste-estados.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("E1136: o que o servidor leu manda; a sessão do navegador só decide quando o servidor não leu", () => {
  // O servidor leu: é ele.
  assert.equal(contaDeTesteSabida(true, undefined), true);
  assert.equal(contaDeTesteSabida(true, false), true, "o caso do silêncio duplo: a sessão desistiu e diz 'conta real'");
  assert.equal(contaDeTesteSabida(false, true), false);
  assert.equal(contaDeTesteSabida(false, undefined), false);
  // O servidor não leu (null) ou a página não disse nada (undefined): vale a sessão, como no E1134.
  for (const servidor of [null, undefined]) {
    assert.equal(contaDeTesteSabida(servidor, true), true);
    assert.equal(contaDeTesteSabida(servidor, false), false);
    assert.equal(contaDeTesteSabida(servidor, undefined), undefined);
  }
});

test("E1136: silêncio duplo — a sessão diz 'conta real' e a busca falha: com a leitura do servidor, a conta de teste vê o erro", () => {
  const sabida = contaDeTesteSabida(true, false);
  assert.deepEqual(vistaDaCaixa(sabida, { fase: "falhou" }), { tipo: "erro" });
  assert.deepEqual(vistaDaCaixa(sabida, { fase: "buscando" }), { tipo: "carregando" });
  // Sem a leitura do servidor continua como antes: nada (a caixa é só de contas de teste).
  assert.deepEqual(vistaDaCaixa(contaDeTesteSabida(null, false), { fase: "falhou" }), { tipo: "nada" });
  // E a conta que o servidor diz ser real não vê nada, mesmo que a sessão do navegador diga o contrário.
  assert.deepEqual(vistaDaCaixa(contaDeTesteSabida(false, true), { fase: "falhou" }), { tipo: "nada" });
  assert.deepEqual(vistaDaCaixa(contaDeTesteSabida(false, true), { fase: "buscando", demorada: true }), { tipo: "nada" });
});

test("E1136: a busca que demora — o carregamento passa a dizer que demora (e a tela mostra 'Tentar de novo'); a conta real continua sem ver nada", () => {
  assert.deepEqual(vistaDaCaixa(true, { fase: "buscando", demorada: true }), { tipo: "carregando", demorada: true });
  assert.deepEqual(vistaDaCaixa(true, { fase: "buscando", demorada: false }), { tipo: "carregando" });
  assert.deepEqual(vistaDaCaixa(true, { fase: "buscando" }), { tipo: "carregando" });
  for (const conta of [false, undefined]) assert.deepEqual(vistaDaCaixa(conta, { fase: "buscando", demorada: true }), { tipo: "nada" });
});

test("E1136: os dois prazos e o texto novo", () => {
  assert.equal(CAIXA_DEMORA_MS, 5_000);
  assert.equal(CAIXA_LIMITE_MS, 15_000);
  assert.ok(CAIXA_DEMORA_MS < CAIXA_LIMITE_MS);
  assert.equal(TEXTO_CAIXA_DEMORADA, "Está demorando mais que o normal.");
});

test("E1136: a tela corta a busca no limite, avisa da demora e usa a leitura do servidor", () => {
  const tela = ler("src/components/account/caixa-emails-teste.tsx");
  assert.match(tela, /new AbortController\(\)/);
  assert.match(tela, /setTimeout\(\(\) => corte\.abort\(\), CAIXA_LIMITE_MS\)/);
  assert.match(tela, /CAIXA_DEMORA_MS\)/);
  assert.match(tela, /signal: corte\.signal/);
  assert.match(tela, /contaDeTesteSabida\(contaDeTesteNoServidor, /);
  assert.match(tela, /data-testid="caixa-emails-teste-demorada"/);
  // "Tentar de novo" nos dois estados: na demora e no erro.
  assert.equal((tela.match(/Tentar de novo/g) ?? []).length, 2);
});

test("E1136: a página da Conta lê no servidor se a conta é de teste e passa à caixa por contexto; não leu = null (vale a sessão)", () => {
  const pagina = ler("src/app/(dashboard)/dashboard/conta/[secao]/page.tsx");
  assert.match(pagina, /comLimite\(usuarioDaSessaoServidor\(\), LIMITE_CASCA_MS\)\s*\.then\(\(u\) => \(u \? u\.isTeste === true : null\)\)\s*\.catch\(\(\) => null\)/);
  assert.match(pagina, /<ContaDeTesteDoServidor valor=\{contaDeTeste\}>\s*<TelaAjuda \/>\s*<\/ContaDeTesteDoServidor>/);
  // Por contexto, não por propriedade: a tela da Ajuda fica como estava (guardas antigas fixam "<CaixaEmailsTeste />").
  assert.match(ler("src/components/account/tela-ajuda.tsx"), /<CaixaEmailsTeste \/>/);
  assert.match(ler("src/components/account/caixa-emails-teste.tsx"), /const contaDeTesteNoServidor = useContaDeTesteDoServidor\(\);/);
});
