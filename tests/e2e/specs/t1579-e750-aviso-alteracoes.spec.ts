import { test, expect } from "@playwright/test";
import { perfilAlterado, retrato } from "../../../src/lib/perfil/retrato";

/*
  T1579 — E750 (#3552): "Há alterações para salvar" some assim que o perfil é salvo, inclusive depois de limpar os idiomas (o retrato do salvo
  acompanha). Só lógica, roda no lab-crítico.
*/
test("E750: salvo == atual -> sem alterações; mudar a bio -> com alterações", () => {
  const salvo = retrato("Ana", "Designer", "Uberlândia", ["Português"]);
  expect(perfilAlterado(salvo, retrato("Ana", "Designer", "Uberlândia", ["Português"]))).toBe(false);
  expect(perfilAlterado(salvo, retrato("Ana", "Outra bio", "Uberlândia", ["Português"]))).toBe(true);
});

test("E750: depois de limpar os idiomas e salvar, o aviso não volta", () => {
  const salvoSemIdiomas = retrato("Ana", "Designer", "Uberlândia", []);
  expect(perfilAlterado(salvoSemIdiomas, retrato("Ana", "Designer", "Uberlândia", []))).toBe(false);
});
