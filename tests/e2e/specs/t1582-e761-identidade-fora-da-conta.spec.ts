import { test, expect } from "@playwright/test";
import { contaDaConferencia } from "../../../src/lib/anuncio/passo10-colunas";

/*
  T1582 — E761 (#3566): a identidade "a confirmar" fica fora da conta do "Antes de publicar" e a conta diz que ela não impede a publicação.
  Só lógica, roda no lab-crítico.
*/
const base = { itens: [{ ok: false, faltam: ["Foto da sala"] }], pendentesNaRevisao: [] as string[], aceitouIa: true };

test("E761: com identidade a confirmar, a conta avisa que não entra nela e não impede de publicar", () => {
  expect(contaDaConferencia({ ...base, identidadeAConfirmar: true })).toMatch(/identidade.*não entra nesta conta e não impede de publicar/i);
});

test("E761: sem identidade a confirmar, a frase não aparece", () => {
  expect(contaDaConferencia({ ...base, identidadeAConfirmar: false }) ?? "").not.toMatch(/identidade/i);
});
