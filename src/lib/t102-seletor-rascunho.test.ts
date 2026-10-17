import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Lab 70f874c: t102 estourava 45 s porque /Continuar|Retomar/ casava com o "Continuar" do rodapé do cadastro.
test("t102: o botão de retomar rascunho é buscado dentro do aviso, não por regex solta", () => {
  const spec = readFileSync("tests/e2e/specs/t102-preco-sugerido.spec.ts", "utf8");
  assert.ok(!/name:\s*\/Continuar\|Retomar\//.test(spec));
  assert.match(spec, /Você tem um anúncio em andamento/);
});

// Lab 8b32a4e: o id do usuário não está no localStorage (a sessão fica em cookie), então o rascunho nunca era gravado
// e o passo de preço não abria. A spec lê o cookie sb-*-auth-token.
test("t102: o id do usuário vem do cookie de sessão, não do localStorage", () => {
  const spec = readFileSync("tests/e2e/specs/t102-preco-sugerido.spec.ts", "utf8");
  assert.match(spec, /context\.cookies\(\)/);
  assert.ok(!/localStorage\)\.find/.test(spec));
});

// Lab 8b32a4e: t69 a 768 px estourava 240 s esperando o "load" do mapa; a espera é só o HTML e o primeiro [data-cta].
test("t69: a varredura de botões não espera o evento load das páginas", () => {
  const spec = readFileSync("tests/e2e/specs/t69-botoes-header.spec.ts", "utf8");
  assert.ok(!/waitForLoadState\("load"\)/.test(spec));
});

// Lab 8b32a4e: o bloco "preco-sugerido" não aparecia em 10 s — isVisible() não espera e o aviso do rascunho
// chega depois do networkidle (getLatestDraft é assíncrono). A spec precisa ESPERAR o aviso ou o bloco.
test("t102: espera o aviso de rascunho ou o bloco do preço antes de decidir (isVisible não espera)", () => {
  const spec = readFileSync("tests/e2e/specs/t102-preco-sugerido.spec.ts", "utf8");
  assert.ok(!/isVisible\(\)\.catch/.test(spec));
  const espera = spec.search(/retomar\.or\(bloco\)[^;]*waitFor/);
  assert.ok(espera > 0 && espera < spec.indexOf("retomar.isVisible("));
  assert.match(spec, /toBeVisible\(\{\s*timeout:\s*\d{5,}/);
});

// Lab 69fd29d: t102 seguiu vermelho sem dizer onde a página estava. O erro agora leva URL e texto da tela.
test("t102: se nada aparece, o erro mostra a URL e o texto da página", () => {
  const spec = readFileSync("tests/e2e/specs/t102-preco-sugerido.spec.ts", "utf8");
  assert.match(spec, /page\.url\(\)/);
  assert.match(spec, /innerText\(\)/);
});

// Lab 69fd29d: t168 "morador pede a visita — 390 px" estourava 120 s (só a 1ª carga, fria): o clique chegava antes
// da hidratação e o formulário não abria. A spec reclica até o campo do horário aparecer.
test("t168: reclica até o formulário de horário abrir (hidratação)", () => {
  const spec = readFileSync("tests/e2e/specs/t168-visita-video.spec.ts", "utf8");
  assert.match(spec, /toPass\(\{\s*timeout:\s*40_000/);
  assert.ok(!/visita-video-abrir"\)\.first\(\)\.click\(\);\s*\n\s*const quando/.test(spec));
});
