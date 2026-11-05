/*
  E613 (Superfície 3, família do E556): com título e descrição VAZIOS no Passo 7, a sugestão (IA ou modelo fixo) era
  gravada sozinha nos campos — a Revisão marcava "Título e descrição — feito", a listagem tirava os dois das faltas e o
  cartão ganhava o título gerado ("Apartamento mobiliado de 2 quartos no Santa Mônica"). O dono podia acreditar que
  escreveu, ou que não precisava escrever. Agora a sugestão fica num cartão à parte e só entra nos campos quando o dono
  escolhe "Usar esta sugestão".
  Roda: node --test src/lib/anuncio/e613-titulo-automatico.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { camposParaUsarSugestao } from "./texto-sugerido.ts";

test("E613: 'Usar esta sugestão' só preenche os campos vazios", () => {
  assert.deepEqual(camposParaUsarSugestao({ titulo: "", descricao: "" }), { titulo: true, descricao: true });
  assert.deepEqual(camposParaUsarSugestao({ titulo: "Meu título", descricao: "  " }), { titulo: false, descricao: true });
  assert.deepEqual(camposParaUsarSugestao({ titulo: "Meu", descricao: "Minha" }), { titulo: false, descricao: false });
});

const pagina = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
const passo7 = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx", import.meta.url), "utf8");

test("E613: pedir a sugestão NUNCA grava título ou descrição (nem a da IA, nem a do modelo fixo)", () => {
  const corpo = pagina.slice(pagina.indexOf("async function pedirSugestao"), pagina.indexOf("function usarSugestao"));
  assert.ok(corpo.length > 100, "pedirSugestao e usarSugestao existem");
  assert.doesNotMatch(corpo, /setTitle\(/);
  assert.doesNotMatch(corpo, /setDescription\(/);
});

test("E613: os campos só recebem a sugestão no clique do dono", () => {
  const corpo = pagina.slice(pagina.indexOf("function usarSugestao"), pagina.indexOf("function usarSugestao") + 900);
  assert.match(corpo, /camposParaUsarSugestao\(/);
  assert.match(corpo, /setTitle\(/);
  assert.match(passo7, /data-testid="sugestao-cartao"/);
  assert.match(passo7, /data-testid="sugestao-usar"/);
  assert.match(passo7, /onClick=\{sugestao\.usar\}/);
});
