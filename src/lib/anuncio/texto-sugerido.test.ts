/* Roda: node --test src/lib/anuncio/texto-sugerido.test.ts — E148-A (título e descrição sugeridos no Passo 7). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { camposQueRecebem, descricaoDoModelo, donoEscreveu, pedeSugestaoAoEntrar, textoDoModelo, tituloDoModelo } from "./texto-sugerido.ts";
import { PALAVRAS_PROIBIDAS, ajustarVocabulario, limparSaida, montarBrief, IA_SYSTEM_PROMPT } from "../ai/anuncio-prompt.ts";

test("modelo fixo: título no padrão '{Tipo} mobiliado de {N} quarto(s) no {bairro}'", () => {
  assert.equal(tituloDoModelo({ tipo: "apartamento", quartos: 2, bairro: "Santa Mônica" }), "Apartamento mobiliado de 2 quartos no Santa Mônica");
  assert.equal(tituloDoModelo({ tipo: "apartamento", quartos: 1, bairro: "Centro" }), "Apartamento mobiliado de 1 quarto no Centro");
  assert.equal(tituloDoModelo({ tipo: "studio", quartos: 1, bairro: "Centro" }), "Studio mobiliado no Centro");
  assert.equal(tituloDoModelo({ tipo: "casa", quartos: 3, cidade: "Uberlândia" }), "Casa mobiliada de 3 quartos em Uberlândia");
});

test("modelo fixo: descrição com quartos, banheiros, área, internet e as 5 primeiras comodidades", () => {
  const d = descricaoDoModelo({
    tipo: "apartamento",
    quartos: 2,
    banheiros: 1,
    areaM2: 58,
    internetMbps: 300,
    comodidades: ["Ar-condicionado", "Máquina de lavar", "Cozinha equipada", "TV", "Varanda", "Piscina"],
  });
  assert.equal(
    d,
    "Apartamento mobiliado com 2 quartos, 1 banheiro e 58 m². Internet de 300 Mbps. Tem ar-condicionado, máquina de lavar, cozinha equipada, tv e varanda. Para estadias de 30 a 180 dias.",
  );
  assert.doesNotMatch(d, /piscina/i, "só as 5 primeiras");
  assert.doesNotMatch(d, PALAVRAS_PROIBIDAS);
});

test("o passo nunca abre vazio: com o mínimo de dados, o modelo já dá título e descrição", () => {
  const t = textoDoModelo({ tipo: "flat" });
  assert.equal(t.titulo, "Flat mobiliado");
  assert.equal(t.descricao, "Flat mobiliado, pronto para morar. Para estadias de 30 a 180 dias.");
});

test("só pede sozinho com título E descrição vazios; nunca sobrescreve o texto do dono", () => {
  assert.equal(pedeSugestaoAoEntrar("", "  "), true);
  assert.equal(pedeSugestaoAoEntrar("Meu título", ""), false);
  const sugerido = { titulo: "Studio mobiliado no Centro", descricao: "Texto da sugestão." };
  assert.deepEqual(camposQueRecebem({ titulo: "", descricao: "" }, null), { titulo: true, descricao: true });
  assert.deepEqual(camposQueRecebem({ titulo: "Escrevi eu", descricao: "" }, null), { titulo: false, descricao: true });
  assert.deepEqual(camposQueRecebem(sugerido, sugerido), { titulo: true, descricao: true }, "a sugestão intacta pode ser trocada");
  assert.equal(donoEscreveu(sugerido, sugerido), false);
  assert.equal(donoEscreveu({ ...sugerido, descricao: "Mudei a descrição" }, sugerido), true, "Gerar de novo pede confirmação");
});

test("vocabulário: o prompt pede o da Viva e proíbe aluguel, temporada, inquilino e comissão", () => {
  for (const w of ["imóvel mobiliado", "morador", "estadias de 30 a 180 dias", "taxa de serviço"]) assert.ok(IA_SYSTEM_PROMPT.includes(w), w);
  assert.match(IA_SYSTEM_PROMPT, /NUNCA use as palavras "aluguel", "temporada", "inquilino" nem "comissão"/);
});

test("limparSaida troca as palavras proibidas que escaparem (e mantém a maiúscula)", () => {
  const saida = limparSaida("Aluguel de temporada para o inquilino, sem comissão. Os inquilinos pagam o aluguel.");
  assert.doesNotMatch(saida, PALAVRAS_PROIBIDAS);
  assert.equal(saida, "Estadia de 30 a 180 dias para o morador, sem taxa de serviço. Os moradores pagam a estadia.");
  assert.equal(ajustarVocabulario("Temporadas e comissões"), "Estadias e taxas de serviço");
});

test("o brief leva área e internet; nunca o nível vindo do cliente, nem endereço ou contato", () => {
  const b = montarBrief({ tipo: "apartamento", areaM2: 58, internetMbps: "300", internetTipo: "fibra", nivel: "Premium", rua: "Rua X, 10", telefone: "34 99999-0000", cep: "38400-000" });
  assert.equal(b.areaM2, 58);
  assert.equal(b.internetMbps, 300);
  assert.equal(b.internetTipo, "fibra");
  assert.equal(b.nivel, undefined, "o nível só entra comprovado, pelo servidor");
  const json = JSON.stringify(b);
  assert.doesNotMatch(json, /Rua X|99999|38400/);
});
