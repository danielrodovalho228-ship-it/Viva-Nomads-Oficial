/*
  Porta do auth (alinhamento visual aos mockups de 23/10): estados do primário na família do verde, véu só onde há
  texto, formulário em cartão branco sobre areia — e as telas da porta usam essas classes.
  Roda: node --test src/lib/auth/porta-visual.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CARTAO_FORMULARIO_PORTA, FUNDO_FORMULARIO_PORTA, PRIMARIO_PORTA, VEU_BASE_PORTA, VEU_TOPO_PORTA } from "./porta-visual.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("primário: esperando = verde a 75% com texto branco (sem opacity-50); carregando = verde cheio", () => {
  assert.match(PRIMARIO_PORTA, /disabled:opacity-100/);
  assert.match(PRIMARIO_PORTA, /disabled:bg-forest\/75/);
  assert.match(PRIMARIO_PORTA, /disabled:text-white/);
  assert.match(PRIMARIO_PORTA, /aria-busy:disabled:bg-forest(\s|$)/);
});

test("foto: escuro só atrás do texto (pílula no logo, cartão no título), sem degradê e sem véu cheio", () => {
  for (const v of [VEU_TOPO_PORTA, VEU_BASE_PORTA]) {
    assert.match(v, /bg-night\/\d+/);
    assert.doesNotMatch(v, /gradient|inset/);
  }
  assert.match(VEU_TOPO_PORTA, /rounded-full/);
  assert.match(VEU_BASE_PORTA, /rounded-xl/);
  const pagina = ler("src/app/auth/page.tsx");
  assert.doesNotMatch(pagina, /absolute inset-0 bg-(night|black)/);
  assert.match(pagina, /data-testid="porta-veu-topo"/);
  assert.match(pagina, /data-testid="porta-veu-base"/);
});

test("formulário: cartão branco sobre areia, sem sombra, raio do padrão", () => {
  assert.equal(FUNDO_FORMULARIO_PORTA, "bg-areia");
  assert.match(CARTAO_FORMULARIO_PORTA, /bg-white/);
  assert.match(CARTAO_FORMULARIO_PORTA, /rounded-xl/);
  assert.doesNotMatch(CARTAO_FORMULARIO_PORTA, /shadow/);
});

test("as telas da porta usam o primário da porta (entrar, código, intenção)", () => {
  for (const f of ["src/app/auth/page.tsx", "src/components/auth/login-por-codigo.tsx", "src/components/auth/escolha-intencao.tsx"]) {
    assert.match(ler(f), /PRIMARIO_PORTA/, f);
  }
});
