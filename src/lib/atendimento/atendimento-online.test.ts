import { test } from "node:test";
import assert from "node:assert/strict";
import { FILAS, filaDaCategoria, triagem, triar } from "./filas.ts";
import { CATEGORIAS, classificar } from "./classificar.ts";
import {
  CHAT_LIMITES,
  INDISPONIVEL_CHAT,
  LIMITE_CHAT,
  SYSTEM_VIVA_CHAT,
  lerConversa,
  responderChatViva,
  semDadosPessoais,
  transcricaoChat,
  type DepsChat,
  type MsgChat,
} from "./viva-chat.ts";

test("triagem: 'pediram Pix por fora' = P1 na fila Antifraude, qualquer que seja a escolha", () => {
  for (const escolhida of ["duvida", "anuncio", "contrato", "cobranca"]) {
    const r = triar(escolhida, "O proprietário pediu pra eu pagar o Pix por fora, direto pra ele");
    assert.equal(r.categoria, "seguranca", escolhida);
    assert.equal(r.fila, "antifraude");
    assert.equal(classificar(r.categoria, "Pix por fora").prioridade, "p1");
  }
  assert.equal(triar("duvida", "Isso é golpe?").fila, "antifraude");
});

test("triagem: Caução e manutenção → Caio; cobrança → Igor; anúncio e documentos → Vitória; resto → Viva", () => {
  assert.deepEqual([triagem("duvida", "Quando devolvem a caução?"), filaDaCategoria("caucao")], ["caucao", "manutencao_caucao"]);
  assert.equal(triagem("contrato", "A caução vai para onde?"), "caucao");
  assert.equal(filaDaCategoria(triagem("duvida", "O chuveiro quebrou e está vazando")), "manutencao_caucao");
  assert.equal(filaDaCategoria("manutencao"), "manutencao_caucao");
  assert.equal(filaDaCategoria(triagem("duvida", "Fui cobrado duas vezes no boleto do plano")), "financeiro");
  assert.equal(triagem("duvida", "Como envio a matrícula do imóvel?"), "documentos");
  assert.equal(filaDaCategoria(triagem("duvida", "Meu anúncio não aparece na busca")), "anuncios");
  assert.equal(filaDaCategoria(triagem("duvida", "Como funciona a plataforma?")), "suporte");
  // Escolha específica não é trocada por palavra solta.
  assert.equal(triagem("conflito", "o anúncio dele tinha outras fotos"), "conflito");
});

test("filas: toda categoria do formulário cai em uma fila, e as internas não aparecem no formulário", () => {
  const todas = Object.values(FILAS).flatMap((f) => f.categorias);
  for (const c of CATEGORIAS) assert.ok(todas.includes(c.key), c.key);
  assert.deepEqual(CATEGORIAS.filter((c) => c.interna).map((c) => c.key).sort(), ["caucao", "documentos", "imovel"]);
});

function deps(over: Partial<DepsChat> = {}) {
  const enviados: { system: string; mensagens: MsgChat[] }[] = [];
  const d: DepsChat = {
    ativa: true,
    limite: async () => "ok",
    modelo: async (system, mensagens) => (enviados.push({ system, mensagens }), "O inquilino não paga taxa à plataforma."),
    ...over,
  };
  return { d, enviados };
}
const conversa = (texto: string): { mensagens: MsgChat[] } => ({ mensagens: [{ role: "user", content: texto }] });

test("chat: responde com as fontes oficiais e se apresenta como assistente virtual", async () => {
  const { d, enviados } = deps();
  const r = await responderChatViva(d, conversa("Inquilino paga taxa?"));
  assert.equal(r.status, 200);
  assert.equal(r.body.resposta, "O inquilino não paga taxa à plataforma.");
  assert.match(enviados[0].system, /assistente virtual da Viva Nomads/);
  assert.match(enviados[0].system, /Fontes oficiais/);
  assert.match(enviados[0].system, /Nunca peça CPF, RG, documentos, senha/);
  assert.match(enviados[0].system, /Assistente Viva 24 h · resposta de uma pessoa em até 24 h/);
  assert.doesNotMatch(SYSTEM_VIVA_CHAT, /7h às 22h/);
});

test("chat: golpe e emergência respondem fixo, sem IA, e sugerem uma pessoa (P1)", async () => {
  const { d, enviados } = deps();
  const g = await responderChatViva(d, conversa("Me pediram Pix por fora para garantir o imóvel"));
  assert.equal(g.body.prioridade, "p1");
  assert.equal(g.body.sugerePessoa, true);
  assert.match(g.body.resposta, /nunca pede Pix/);
  const e = await responderChatViva(d, conversa("Está saindo fumaça da tomada"));
  assert.match(e.body.resposta, /193/);
  assert.equal(enviados.length, 0);
});

test("chat: CPF, cartão, telefone e e-mail nunca chegam ao modelo", async () => {
  const { d, enviados } = deps();
  await responderChatViva(d, conversa("Meu CPF é 123.456.789-09, cartão 4111 1111 1111 1111, fone (34) 99999-8888, ana@exemplo.com"));
  const enviado = enviados[0].mensagens[0].content;
  for (const vazado of ["123.456.789-09", "4111", "99999-8888", "ana@exemplo.com"]) assert.ok(!enviado.includes(vazado), vazado);
  assert.equal(semDadosPessoais("aluguel de R$ 3.200"), "aluguel de R$ 3.200");
});

test("chat: limites (por IP, por conversa, tamanho) e Viva fora do ar", async () => {
  assert.equal((await responderChatViva(deps({ limite: async () => "estourou" }).d, conversa("oi"))).status, 429);
  const longa: MsgChat[] = [];
  for (let i = 0; i <= CHAT_LIMITES.porConversa; i++) longa.push({ role: "user", content: `pergunta ${i}` }, { role: "assistant", content: "ok" });
  longa.pop();
  assert.equal(lerConversa(longa), null, "conversa acima do teto é recusada");
  assert.equal((await responderChatViva(deps().d, conversa("x".repeat(CHAT_LIMITES.caracteres + 1)))).status, 400);
  const fora = await responderChatViva(deps({ ativa: false }).d, conversa("oi"));
  assert.equal(fora.body.resposta, INDISPONIVEL_CHAT);
  assert.equal(fora.body.indisponivel, true);
  const falha = await responderChatViva(deps({ modelo: async () => { throw new Error("timeout"); } }).d, conversa("oi"));
  assert.equal(falha.body.sugerePessoa, true);
  assert.ok(LIMITE_CHAT.includes("Falar com uma pessoa"));
});

test("chat → chamado: a conversa vai anexada e cabe no chamado", () => {
  const t = transcricaoChat([{ role: "user", content: "Quando devolvem a caução?" }, { role: "assistant", content: "No fim, depois da vistoria." }], "Quero falar com alguém");
  assert.match(t, /^Conversa com a Viva no chat do site:\nPessoa: Quando devolvem a caução\?\nViva: No fim, depois da vistoria\.\n\nPedido para a equipe: Quero falar com alguém$/);
  const grande = transcricaoChat(Array.from({ length: 40 }, () => ({ role: "user" as const, content: "x".repeat(800) })));
  assert.ok(grande.length <= 4000);
  // E a triagem do chamado vê o golpe dentro da conversa anexada.
  assert.equal(triar("duvida", transcricaoChat([{ role: "user", content: "pediram pix por fora" }])).fila, "antifraude");
});
