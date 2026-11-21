/** Testes da proteção de contato no chat — `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { guardContactInfo } from "./contact-guard.ts";

const MASK = "[contato protegido]";

test("mascara celular com DDD (formatado)", () => {
  const r = guardContactInfo("me chama no (34) 99999-0001 por favor");
  assert.equal(r.masked, true);
  assert.ok(!r.text.includes("99999"));
  assert.ok(r.text.includes(MASK));
});

test("mascara celular colado e com +55", () => {
  assert.equal(guardContactInfo("meu número é 34999990001").masked, true);
  assert.equal(guardContactInfo("liga no +55 34 9 9999-0001").masked, true);
});

test("mascara e-mail", () => {
  const r = guardContactInfo("manda pra ana.silva+vn@gmail.com");
  assert.equal(r.masked, true);
  assert.ok(!r.text.includes("@gmail.com"));
});

test("mascara link de WhatsApp/Telegram", () => {
  assert.equal(guardContactInfo("https://wa.me/5534999990001 me add").masked, true);
  assert.equal(guardContactInfo("t.me/fulano").masked, true);
});

test("mascara perfil de rede social por URL", () => {
  assert.equal(guardContactInfo("meu insta é instagram.com/maria.nomad").masked, true);
  assert.equal(guardContactInfo("https://www.facebook.com/fulano.de.tal").masked, true);
  assert.equal(guardContactInfo("tiktok.com/@viajante").masked, true);
});

test("mascara @handle solto (me chama no insta @maria.silva)", () => {
  const r = guardContactInfo("me chama no insta @maria.silva");
  assert.equal(r.masked, true);
  assert.ok(!r.text.includes("@maria.silva"));
  assert.ok(r.text.includes(MASK));
});

test("T-TRAV-F: mascara os 3 padrões (telefone, e-mail, @instagram)", () => {
  const r = guardContactInfo(
    "liga (34) 99999-0001, e-mail joao@teste.com ou me segue no insta @joao.nomad",
  );
  assert.equal(r.masked, true);
  assert.ok(!r.text.includes("99999"), "telefone não mascarado");
  assert.ok(!r.text.includes("joao@teste.com"), "e-mail não mascarado");
  assert.ok(!r.text.includes("@joao.nomad"), "handle não mascarado");
});

test("NÃO mascara CEP, data, valor e texto comum", () => {
  for (const s of [
    "o CEP é 38400-000",
    "entrada em 02/07/2026",
    "o aluguel é R$ 3.200 e a caução R$ 6.400",
    "o prédio tem 20 andares e fica no número 1520",
    "Olá! O imóvel está disponível a partir de agosto?",
  ]) {
    const r = guardContactInfo(s);
    assert.equal(r.masked, false, `não deveria mascarar: "${s}" → "${r.text}"`);
    assert.equal(r.text, s);
  }
});

test("é idempotente (mascarar duas vezes não muda)", () => {
  const once = guardContactInfo("tel (34) 99999-0001").text;
  assert.equal(guardContactInfo(once).text, once);
});

test("não mascara id (UUID) com sequência de dígitos parecida com telefone", () => {
  for (const id of ["c869356d-8442-51f0-9234-56789012abcd", "c869356d-8442-51f0-8a3b-123456789012"]) {
    const s = `Denúncia de mensagem suspeita na conversa ${id}. Observação da pessoa: ok.`;
    const r = guardContactInfo(s);
    assert.equal(r.masked, false, `mascarou o id: "${r.text}"`);
    assert.equal(r.text, s);
  }
  assert.equal(guardContactInfo("id 12345678-1234-1234-1234-123456789012 e tel (34) 99999-0001").masked, true);
});

test("E483: telefone com DDD entre parênteses some inteiro — não sobra '(' antes do marcador", () => {
  assert.equal(guardContactInfo("Me chama no (34) 99999-8888 amanhã").text, `Me chama no ${MASK} amanhã`);
  assert.equal(guardContactInfo("(11) 98765-4321").text, MASK);
  assert.equal(guardContactInfo("liga no +55 (34) 99999-8888.").text, `liga no ${MASK}.`);
});

test("E483: parêntese que envolve a frase continua equilibrado", () => {
  // o número inteiro entre parênteses: os dois saem com ele
  assert.equal(guardContactInfo("meu zap (11 98765-4321) ok").text, `meu zap ${MASK} ok`);
  // o parêntese abre antes de outra palavra: o ")" do fim fica, para fechar o que abriu
  assert.equal(guardContactInfo("contato (tel 11 98765-4321) ok").text, `contato (tel ${MASK}) ok`);
  // o parêntese abre colado no número e fecha depois de outra palavra: o "(" fica
  assert.equal(guardContactInfo("ligue (11 98765-4321 depois das 18h)").text, `ligue (${MASK} depois das 18h)`);
});

// ── Família 6, parte C: lacunas da proteção de contato (cada variante e cada falso positivo é um caso próprio) ──────────
const LINK = "[link protegido]";
const some = (texto: string, ...partes: string[]) => {
  const r = guardContactInfo(texto);
  assert.equal(r.masked, true, `mascarou: ${texto}`);
  for (const p of partes) assert.ok(!r.text.includes(p), `"${p}" sumiu de: ${r.text}`);
  return r;
};
const fica = (texto: string) => {
  const r = guardContactInfo(texto);
  assert.equal(r.masked, false, `não mascarou: ${texto} → ${r.text}`);
  assert.equal(r.text, texto);
  assert.equal(r.documento, false);
};

// Lacuna 1 — telefone por extenso e misto (8+ dígitos em sequência).
test("F6C lacuna 1: telefone todo por extenso, separado por espaço", () => {
  some("me liga no nove oito sete seis cinco quatro três dois um", "nove oito", "dois um");
});
test("F6C lacuna 1: telefone misto (extenso + algarismos)", () => {
  some("nove 8 seis 5 quatro 3 dois 1 zero", "nove 8", "1 zero");
});
test("F6C lacuna 1: telefone por extenso separado por ponto", () => {
  some("anota: nove.oito.sete.seis.cinco.quatro.três.dois", "nove.oito", "três.dois");
});
test("F6C lacuna 1: telefone por extenso separado por hífen", () => {
  some("nove-oito-sete-seis-cinco-quatro-três-dois-um", "nove-oito", "dois-um");
});
test("F6C lacuna 1: telefone por extenso separado por 'e'", () => {
  some("é nove e oito e sete e seis e cinco e quatro e três e dois", "nove e oito", "três e dois");
});
test("F6C lacuna 1: DDD em algarismos e o resto por extenso", () => {
  some("34 nove nove oito sete seis cinco quatro três", "nove nove", "34 nove");
});
test("F6C lacuna 1: grupos de algarismos com palavras no meio (9 8765 quatro três dois um)", () => {
  some("9 8765 quatro três dois um", "8765", "dois um");
});

// Lacuna 2 — e-mail ofuscado.
test("F6C lacuna 2: e-mail 'nome arroba gmail ponto com'", () => {
  some("manda pra ana.silva arroba gmail ponto com", "arroba gmail", "ponto com");
});
test("F6C lacuna 2: e-mail 'nome [at] gmail [dot] com'", () => {
  some("ana [at] gmail [dot] com", "[at]", "[dot] com");
});
test("F6C lacuna 2: e-mail 'nome @ gmail . com' (com espaços)", () => {
  some("ana @ gmail . com", "@ gmail", "gmail . com");
});
test("F6C lacuna 2: e-mail '(at)/(dot)' e com '.com.br' por extenso", () => {
  some("ana(at)hotmail(dot)com", "hotmail");
  some("ana arroba uol ponto com ponto br", "arroba uol", "ponto br");
});

// Lacuna 3 — mensageiro citado sem link, seguido de número (mesmo parcial): o número some; a expressão sozinha, não.
test("F6C lacuna 3: 'me chama no zap' + número completo", () => {
  some("me chama no zap 34 99999-0001", "99999", "0001");
});
test("F6C lacuna 3: 'whats' + número parcial", () => {
  some("me chama no whats 9876", "9876");
});
test("F6C lacuna 3: 'wpp:' + número parcial por extenso", () => {
  some("wpp: nove oito sete seis", "nove oito", "sete seis");
});
test("F6C lacuna 3: 'telegram' + número parcial", () => {
  some("me acha no telegram 98765", "98765");
});
test("F6C lacuna 3: a expressão sozinha, sem número, não mascara", () => {
  fica("me chama no zap");
  fica("pode falar comigo no whats depois?");
  fica("tem telegram?");
});
test("F6C lacuna 3: 'zap' seguido de horário não é número de contato", () => {
  fica("me chama no zap às 14h30");
});

// Lacuna 4 — arrobas e perfis de rede social: a regra de hoje (mascarar) fica coberta por teste.
test("F6C lacuna 4: @usuario solto vira contato protegido", () => {
  some("me segue @ana_viagens", "ana_viagens");
});
test("F6C lacuna 4: perfil do Instagram por URL", () => {
  some("instagram.com/ana.viagens", "ana.viagens");
});
test("F6C lacuna 4: perfil do TikTok por URL (com @)", () => {
  some("tiktok.com/@anaviagens", "anaviagens");
});
test("F6C lacuna 4: perfil do Facebook por URL", () => {
  some("https://www.facebook.com/ana.silva.123", "ana.silva");
  assert.ok(!guardContactInfo("facebook.com/ana").text.includes(LINK), "perfil sai como contato, não como link");
});

// Falsos positivos — nada disto pode ser mascarado.
test("F6C falso positivo: datas ('dia 20/11', '20 de novembro')", () => {
  fica("chego no dia 20/11");
  fica("a entrada é 20 de novembro");
});
test("F6C falso positivo: valores ('R$ 3.960', '3960 reais')", () => {
  fica("o total fica R$ 3.960 por mês");
  fica("são 3960 reais no total");
});
test("F6C falso positivo: '3 quartos', '2 banheiros', '72 m²'", () => {
  fica("tem 3 quartos, 2 banheiros e 72 m²");
});
test("F6C falso positivo: horários ('às 14h30')", () => {
  fica("posso visitar às 14h30");
});
test("F6C falso positivo: número do imóvel no endereço ('Rua X, 1500')", () => {
  fica("fica na Rua X, 1500");
});
test("F6C falso positivo: CEP", () => {
  fica("CEP 38408-100");
  fica("o CEP é 38408100");
});
test("F6C falso positivo: números do pedido, do orçamento e do contrato", () => {
  fica("sobre o pedido VN-PD-11281A61");
  fica("o orçamento ORC-2026-0007 v2");
  fica("contrato VN-CT-2026-0042, VN-CT-11281A61-AD1 e CT-12345678");
});
test("F6C: um prefixo da casa na frente de um telefone não o esconde", () => {
  some("VN-PD-34999990001", "34999990001");
  some("ORC-34999990001", "34999990001");
});
test("F6C falso positivo: a frase 'nove dias' e números por extenso curtos", () => {
  fica("fico nove dias");
  fica("são dois quartos e um banheiro");
  fica("de um a três meses");
});

// Limite conhecido, registrado e NÃO prometido: documenta o comportamento atual, sem asserção de bloqueio.
test("F6C limite conhecido: número quebrado em várias mensagens passa em cada uma (não prometido)", () => {
  const partes = ["meu número começa com 3499", "depois 9990", "e termina 001"].map((m) => guardContactInfo(m));
  // Cada pedaço sozinho tem menos de 8 dígitos: hoje nenhum é mascarado. É o limite registrado (a conversa não junta
  // mensagens). Este teste não promete bloqueio: só registra o que acontece.
  assert.deepEqual(partes.map((p) => p.masked), [false, false, false]);
});
