/* E757 — um estado só para a identidade, dito igual em toda tela. Roda: node --test src/lib/e757-identidade-texto-unico.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PASSOS_MORADOR } from "../config/caminho-reserva.ts";
import { IDENTIDADE_ESTADO_FRASE } from "./identidade/texto-unico.ts";
import { TEXTO_IDENTIDADE_EM_BREVE } from "./vistoria/telas-exibicao.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const TELAS = [
  "src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx",
  "src/app/(public)/seguranca/page.tsx",
  "src/app/(public)/para-proprietarios/page.tsx",
  "src/app/(public)/parceiros/page.tsx",
  "src/config/caminho-reserva.ts",
  "src/lib/vistoria/telas-exibicao.ts",
  "src/lib/contas-de-teste.ts",
];

test("nenhuma tela diz que a verificação de identidade 'chega/abre em breve' ou 'perto do lançamento'", () => {
  for (const t of TELAS) {
    const s = ler(t);
    assert.doesNotMatch(s, /identidade[^."]{0,60}(chega|abre) em breve/i, t);
    assert.doesNotMatch(s, /abre perto do lançamento/i, t);
  }
});

test("o caminho do morador e o complemento do passo usam o estado único", () => {
  assert.ok(PASSOS_MORADOR[2].texto.includes(IDENTIDADE_ESTADO_FRASE));
  assert.match(TEXTO_IDENTIDADE_EM_BREVE, /ainda não abriu/);
  assert.match(TEXTO_IDENTIDADE_EM_BREVE, /equipe da Viva confere o documento/);
});

test("/parceiros passo 2 não apresenta como corrente uma checagem automática que não abriu", () => {
  assert.match(ler("src/app/(public)/parceiros/page.tsx"), /ainda não abriu/);
});
