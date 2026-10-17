/*
  Ordem e8838fa3 (D2, D10): o assistente e a Central de Ajuda dizem o MESMO que as páginas
  públicas. Fonte das respostas esperadas: CAUCAO_FRASE (/precos e /como-funciona) e
  "30 a 180 dias". Sem blocos, sem percentual por bloco.
*/
import test from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_VIVA } from "../../src/lib/atendimento/viva-prompt.ts";
import { FAQ } from "../../src/lib/atendimento/faq.ts";
import { CAUCAO_FRASE } from "../../src/lib/faixas.ts";

const RESPOSTA = (id: string) => FAQ.find((f) => f.id === id)?.resposta ?? "";
const REGRA_ANTIGA = /50\s?%|cada bloco|blocos? de até|90 dias|3 aluguéis/i;

test("caução: a Ajuda e o prompt repetem a frase oficial, sem regra de bloco", () => {
  assert.ok(RESPOSTA("caucao").startsWith(CAUCAO_FRASE));
  assert.match(RESPOSTA("caucao"), /conferência de saída/);
  assert.doesNotMatch(RESPOSTA("caucao"), REGRA_ANTIGA);
  assert.ok(SYSTEM_VIVA.includes(CAUCAO_FRASE));
});

test("prazo: 30 a 180 dias, sem blocos, na Ajuda e no prompt", () => {
  assert.match(RESPOSTA("prazo"), /30 a 180 dias/);
  assert.doesNotMatch(RESPOSTA("prazo"), REGRA_ANTIGA);
  assert.doesNotMatch(RESPOSTA("renovar"), /\bbloco/i);
  assert.match(SYSTEM_VIVA, /30 a 180 dias/);
  const regras = SYSTEM_VIVA.slice(SYSTEM_VIVA.indexOf("## Regras do contrato"), SYSTEM_VIVA.indexOf("## Parcerias"));
  assert.doesNotMatch(regras, /50\s?%|3 aluguéis|em blocos de até/i);
});

test("quem paga a taxa e quando o contato do dono aparece", () => {
  assert.match(SYSTEM_VIVA, /cobrada só do proprietário/);
  assert.match(SYSTEM_VIVA, /Quem vem morar não paga taxa da plataforma/);
  assert.match(SYSTEM_VIVA, /Contato direto \(telefone, e-mail, redes\) nunca é trocado/);
});

test("Ajuda: uma pergunta só sobre virar parceiro, coerente com /parceiros e /empresas", () => {
  const parceiro = FAQ.filter((f) => /parceir/i.test(f.pergunta) && /virar/i.test(f.pergunta));
  assert.equal(parceiro.length, 1);
  assert.equal(parceiro[0].pergunta, "Como posso virar parceiro da Viva?");
  assert.match(parceiro[0].resposta, /quer moradia para funcionários: \/empresas/);
  assert.match(parceiro[0].resposta, /quer ser parceira[^.]*\/parceiros/);
  assert.doesNotMatch(parceiro[0].resposta, /apartamentos?|comiss[ãa]o|corretagem|intermedia[çc][ãa]o|aluguel|temporada|art\. 48/i);
});
