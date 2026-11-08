import { test, expect } from "@playwright/test";
import { avisosDaFoto, contrasteCinza, nitidezLaplaciano } from "../../../src/lib/fotos/qualidade";

/*
  T1585 — E751 (#3580): imagem de uma cor só NÃO é "tremida ou sem foco": o motivo que a triagem sustenta é "imagem lisa" ("Imagem de uma cor só, sem o cômodo");
  foto com conteúdo e baixa nitidez continua "tremida". Só lógica da triagem (sem página), roda no lab-crítico.
*/
test("E751: arquivo sólido -> 'lisa', sem 'tremida'", () => {
  const w = 20;
  const lisa = new Float32Array(w * w).fill(128);
  const analise = { largura: 3000, altura: 2000, luminancia: 128, nitidez: nitidezLaplaciano(lisa, w, w), contraste: contrasteCinza(lisa), hash: "0123456789abcdef" };
  const codigos = avisosDaFoto(analise).map((a) => a.codigo);
  expect(codigos).toContain("lisa");
  expect(codigos).not.toContain("tremida");
});

test("E751: foto com conteúdo e pouca nitidez continua 'tremida'; contraste 0 só em imagem lisa", () => {
  const boa = { largura: 3000, altura: 2000, luminancia: 128, nitidez: 5, contraste: 40, hash: "0123456789abcdef" };
  expect(avisosDaFoto(boa).map((a) => a.codigo)).toEqual(["tremida"]);
  expect(contrasteCinza([10, 10, 10])).toBe(0);
  expect(contrasteCinza([0, 255, 0, 255])).toBeGreaterThan(100);
});
