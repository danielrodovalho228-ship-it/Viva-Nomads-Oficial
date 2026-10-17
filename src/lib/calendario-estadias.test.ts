import { test } from "node:test";
import assert from "node:assert/strict";
import { segmentosDaPilula, rotuloPilula, primeiroNome, rotuloSeloEstadia } from "./calendario-estadias.ts";

// Novembro/2026 começa num domingo (coluna 0).
test("estadia dentro de uma semana: um segmento só, com avatar", () => {
  const s = segmentosDaPilula("2026-11-03", "2026-11-05", 2026, 10);
  assert.deepEqual(s, [
    { semana: 0, colIni: 2, colFim: 4, abreAqui: true, continuaAntes: false, continuaDepois: false },
  ]);
});

test("estadia que atravessa semanas quebra na linha seguinte; só o 1º segmento abre", () => {
  const s = segmentosDaPilula("2026-11-05", "2026-11-18", 2026, 10);
  assert.equal(s.length, 3);
  assert.deepEqual(s.map((x) => [x.semana, x.colIni, x.colFim]), [[0, 4, 6], [1, 0, 6], [2, 0, 3]]);
  assert.deepEqual(s.map((x) => x.abreAqui), [true, false, false]);
  assert.deepEqual(s.map((x) => x.continuaDepois), [true, true, false]);
  assert.deepEqual(s.map((x) => x.continuaAntes), [false, true, true]);
});

test("estadia que começou antes do mês entra reta pela esquerda; fora do mês não gera nada", () => {
  const s = segmentosDaPilula("2026-10-20", "2026-11-02", 2026, 10);
  assert.equal(s.length, 1);
  assert.equal(s[0].continuaAntes, true);
  assert.equal(s[0].continuaDepois, false);
  assert.deepEqual(segmentosDaPilula("2026-12-01", "2026-12-10", 2026, 10), []);
  assert.deepEqual(segmentosDaPilula("2026-11-10", "2026-11-01", 2026, 10), []);
});

test("estadia que passa do fim do mês sai reta pela direita", () => {
  const s = segmentosDaPilula("2026-11-28", "2026-12-15", 2026, 10);
  assert.equal(s.at(-1)?.continuaDepois, true);
});

test("rótulo acessível e primeiro nome", () => {
  assert.equal(rotuloPilula("Ana", "2026-11-05", "2026-12-20"), "Reservado por Ana, 05/11 a 20/12");
  assert.equal(primeiroNome("  Ana Souza Lima "), "Ana");
  assert.equal(primeiroNome(null), "Inquilino");
});

test("selo da estadia do inquilino: primeiro nome do anfitrião ou 'Sua estadia'", () => {
  assert.equal(rotuloSeloEstadia("Maria Souza Lima"), "Maria");
  assert.equal(rotuloSeloEstadia("  João  "), "João");
  assert.equal(rotuloSeloEstadia(""), "Sua estadia");
  assert.equal(rotuloSeloEstadia(null), "Sua estadia");
  assert.equal(rotuloSeloEstadia(undefined), "Sua estadia");
});
