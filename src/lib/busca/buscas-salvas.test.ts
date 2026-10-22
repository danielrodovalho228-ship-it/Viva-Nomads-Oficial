import test from "node:test";
import assert from "node:assert/strict";
import { normalizarBusca, resumoDaBusca } from "./buscas-salvas.ts";

test("busca salva guarda os filtros em ordem fixa (quartos antes de homeoffice), como o spec t125 consulta", () => {
  const salva = normalizarBusca("?local=Uberl%C3%A2ndia&homeoffice=1&quartos=2&utm=x");
  assert.match(salva, /quartos=2.*homeoffice=1/);
  assert.doesNotMatch(salva, /utm/);
  assert.equal(normalizarBusca("homeoffice=1&quartos=2&local=Uberl%C3%A2ndia"), salva);
});

test("37: a busca salva guarda destino, meio e 'até' — e o resumo diz", () => {
  const qs = normalizarBusca("local=Uberl%C3%A2ndia&destino=hc-ufu&modo=carro&ate=20&lixo=1");
  assert.equal(qs, "local=Uberl%C3%A2ndia&destino=hc-ufu&modo=carro&ate=20");
  assert.equal(resumoDaBusca(qs), "Uberlândia · até 20 min de carro até HC-UFU");
  assert.equal(resumoDaBusca(qs, () => "o HC-UFU"), "Uberlândia · até 20 min de carro até o HC-UFU");
  assert.equal(resumoDaBusca("dlat=-18.92&dlng=-48.26&drot=Av.+Par%C3%A1&modo=a_pe"), "Todas as cidades · perto de Av. Pará");
});
