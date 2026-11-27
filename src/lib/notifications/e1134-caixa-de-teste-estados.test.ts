/*
  E1134 (ORDEM-DUET-589, ao serviço da linha Parceiros): a Caixa de e-mails de teste (Conta › Ajuda) sumia em silêncio
  enquanto buscava e quando a busca falhava. "Não li" não é "não tem": a conta de teste vê "carregando" enquanto a busca
  corre e "não foi possível ler" quando falha; só a resposta lida do servidor decide entre a lista, a caixa vazia e nada.
  A conta real continua sem ver nada, em qualquer estado.
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXTO_CAIXA_CARREGANDO, TEXTO_CAIXA_NAO_LIDA, leituraDaResposta, vistaDaCaixa } from "./caixa-teste-estados.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const email = { id: "e1", criado_em: "2026-11-23T18:00:00Z", evento: "x", assunto: "Assunto", corpo: "Corpo" };

test("E1134: enquanto busca, a conta de teste vê 'carregando' — nunca nada", () => {
  assert.deepEqual(vistaDaCaixa(true, { fase: "buscando" }), { tipo: "carregando" });
});

test("E1134: a busca falhou — a conta de teste vê que a caixa não foi lida, nunca 'nenhum e-mail' nem nada", () => {
  assert.deepEqual(vistaDaCaixa(true, { fase: "falhou" }), { tipo: "erro" });
});

test("E1134: a resposta lida decide — lista com e-mails, caixa vazia, ou nada quando o servidor diz que a conta não é de teste", () => {
  assert.deepEqual(vistaDaCaixa(true, { fase: "lida", emails: [email] }), { tipo: "lista", emails: [email] });
  assert.deepEqual(vistaDaCaixa(true, { fase: "lida", emails: [] }), { tipo: "lista", emails: [] });
  assert.deepEqual(vistaDaCaixa(true, { fase: "lida", emails: null }), { tipo: "nada" });
  // O servidor é quem manda: se ele devolve a lista, ela aparece mesmo que a tela ainda não saiba que a conta é de teste.
  assert.deepEqual(vistaDaCaixa(undefined, { fase: "lida", emails: [email] }), { tipo: "lista", emails: [email] });
  assert.deepEqual(vistaDaCaixa(false, { fase: "lida", emails: [] }), { tipo: "lista", emails: [] });
});

test("E1134: a conta real (ou ainda não sabida) não vê a caixa em nenhum estado sem lista", () => {
  for (const conta of [false, undefined]) {
    assert.deepEqual(vistaDaCaixa(conta, { fase: "buscando" }), { tipo: "nada" });
    assert.deepEqual(vistaDaCaixa(conta, { fase: "falhou" }), { tipo: "nada" });
    assert.deepEqual(vistaDaCaixa(conta, { fase: "lida", emails: null }), { tipo: "nada" });
  }
});

test("E1134: a resposta da rota — só 200 com a lista (ou null) conta como lida; o resto é 'não li'", () => {
  assert.deepEqual(leituraDaResposta(true, { emails: [email] }), { fase: "lida", emails: [email] });
  assert.deepEqual(leituraDaResposta(true, { emails: [] }), { fase: "lida", emails: [] });
  assert.deepEqual(leituraDaResposta(true, { emails: null }), { fase: "lida", emails: null });
  // 401, 503, 500: não li.
  assert.deepEqual(leituraDaResposta(false, { error: "Serviço indisponível." }), { fase: "falhou" });
  assert.deepEqual(leituraDaResposta(false, { emails: [] }), { fase: "falhou" });
  // 200 sem o campo, ou com o campo de outro tipo, ou sem corpo: não li (antes: ficava em silêncio para sempre).
  for (const corpo of [{}, null, undefined, "texto", { emails: "x" }, { emails: 3 }]) assert.deepEqual(leituraDaResposta(true, corpo), { fase: "falhou" });
});

test("E1134: os dois textos novos", () => {
  assert.equal(TEXTO_CAIXA_CARREGANDO, "Carregando os e-mails…");
  assert.equal(TEXTO_CAIXA_NAO_LIDA, "Não foi possível ler a caixa agora. Isso não quer dizer que ela está vazia.");
});

test("E1134: a tela liga as peças — sem 'return null' por não ter lido, com os três estados e 'Tentar de novo'", () => {
  const tela = ler("src/components/account/caixa-emails-teste.tsx");
  assert.doesNotMatch(tela, /if \(!emails\) return null/);
  assert.doesNotMatch(tela, /\.catch\(\(\) => undefined\)/);
  assert.match(tela, /vistaDaCaixa\(/);
  assert.match(tela, /leituraDaResposta\(/);
  assert.match(tela, /useAuthStore\(\(s\) => s\.user\?\.isTeste\)/);
  assert.match(tela, /data-testid="caixa-emails-teste-carregando"/);
  assert.match(tela, /data-testid="caixa-emails-teste-erro"/);
  assert.match(tela, /Tentar de novo/);
  // A âncora (#caixa-emails-teste) existe nos três estados visíveis.
  assert.equal((tela.match(/<div id="caixa-emails-teste" /g) ?? []).length, 3);
});

test("E1134: a rota não troca 'não li' por 'não tem' — falha a conferir a conta ou a ler os e-mails responde 503", () => {
  const rota = ler("src/app/api/conta/caixa-teste/route.ts");
  // Antes: contaEhDeTeste(...).catch(() => false) respondia "conta real" (emails: null) quando a conferência falhava.
  assert.doesNotMatch(rota, /contaEhDeTeste\(admin, user\.id\)\.catch\(\(\) => false\)/);
  // Antes: `const { data } = await admin.from("emails_teste")…` e `data ?? []`: a leitura falhada virava caixa vazia.
  assert.match(rota, /const \{ data, error \} = await admin\s*\.from\("emails_teste"\)/);
  assert.equal((rota.match(/NAO_LIDA, \{ status: 503/g) ?? []).length, 2);
  // Continua: conta real recebe 200 com emails null (sem 404 no console), e só as linhas da própria conta.
  assert.match(rota, /emails: null/);
  assert.match(rota, /\.eq\("usuario_id", user\.id\)/);
});
