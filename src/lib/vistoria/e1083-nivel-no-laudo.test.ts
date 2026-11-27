/*
  E1083, parte 2 (ORDEM-DUET-399; decisão da ORDEM-DUET-397, ponto 1): a perna 7 da prova falhou também porque o
  formulário do laudo não tinha seletor de nível. Quem define o nível é o AVALIADOR, no laudo que assina; não existe
  cálculo automático da plataforma. A trava afirma: o nível gravado é o que o avaliador escolheu no laudo assinado.
  Roda: node --test src/lib/vistoria/e1083-nivel-no-laudo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_ESCOLHA_O_NIVEL, ROTULO_NIVEL_LAUDO, lerNivelDoLaudo } from "./nivel-do-laudo.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const SRV = ler("src/lib/vistoria/laudo-servidor.ts");
const ACOES = ler("src/lib/vistoria/laudo-actions.ts");
const TELA = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");

test("E1083: o nível do formulário — só Essencial, Conforto ou Premium", () => {
  assert.equal(lerNivelDoLaudo("essencial"), "essencial");
  assert.equal(lerNivelDoLaudo("conforto"), "conforto");
  assert.equal(lerNivelDoLaudo("premium"), "premium");
  for (const v of ["", null, undefined, "em_adequacao", "PREMIUM", "outro"]) assert.equal(lerNivelDoLaudo(v), null, String(v));
  assert.deepEqual(Object.values(ROTULO_NIVEL_LAUDO), ["Essencial", "Conforto", "Premium"]);
});

test("E1083: o laudo grava o nível ESCOLHIDO pelo avaliador — a plataforma não calcula o nível do laudo", () => {
  const emitir = SRV.slice(SRV.indexOf("export async function emitirLaudo"), SRV.indexOf("export async function registrarCorrecao"));
  assert.doesNotMatch(emitir, /nivelSustentado\(/, "nenhum cálculo automático do nível na emissão");
  assert.match(emitir, /const nivel = escolhido \?\? anterior\?\.nivel_sustentado \?\? null;/);
  assert.match(emitir, /if \(!nivel\) return \{ ok: false, erro: MSG_ESCOLHA_O_NIVEL \};/);
  assert.match(emitir, /nivel_sustentado: nivel,/);
  // 1ª emissão (e contestação, que é pedido novo): o avaliador TEM de escolher; a versão de correção mantém a escolha anterior se não vier outra.
  assert.match(emitir, /const escolhido = assinar\.nivel \?\? null;/);
  assert.match(emitir, /if \(!motivoVersao && !escolhido\) return \{ ok: false, erro: MSG_ESCOLHA_O_NIVEL \};/);
});

test("E1083: os dois formulários assinados levam o seletor de nível e a ação lê o nível", () => {
  assert.match(ACOES, /emitirLaudo\(c\.admin, c\.p\.id, new Date\(\), null, \{ declarou: form\.get\("assino"\) === "on", nivel: lerNivelDoLaudo\(form\.get\("nivel"\)\) \}\)/);
  assert.match(ACOES, /registrarCorrecao\(s\.admin, l\.pedido_id, corrigidos, new Date\(\), \{ declarou: form\.get\("assino"\) === "on", nivel: lerNivelDoLaudo\(form\.get\("nivel"\)\) \}\)/);
  assert.equal((TELA.match(/<SeletorNivelLaudo /g) ?? []).length, 2, "enviar o laudo e confirmar a reverificação");
  assert.match(TELA, /name="nivel"[\s\S]*?required=\{obrigatorio\}/);
});

test("E1083: o dono vê o nível gravado no laudo (a mesma coluna)", () => {
  assert.match(SRV, /nivel: l\.nivel_sustentado,/);
});

test("E1083: a mensagem quando falta o nível", () => {
  assert.equal(MSG_ESCOLHA_O_NIVEL, "Escolha o nível do imóvel (Essencial, Conforto ou Premium).");
});
