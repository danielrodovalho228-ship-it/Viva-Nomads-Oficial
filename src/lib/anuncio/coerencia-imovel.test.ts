import test from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { tituloAbaImovel } from "./metadados-imovel.ts";
import { quartosTexto, banheirosTexto } from "./plural.ts";
import { proximidadesDoImovel, proximidadesVisiveis } from "./proximidades.ts";
import { destaquesDoImovel } from "./resumos-imovel.ts";
import { textosTotalMensal } from "../precos.ts";
import { estadoDiaCalendario } from "../availability.ts";
import { INTERNET_META } from "../internet.ts";

test("D6: o título da aba anuncia o mesmo total do cartão, nos 15 exemplos (ordem dd15064d)", () => {
  assert.equal(SAMPLE_PROPERTIES.length, 15);
  for (const p of SAMPLE_PROPERTIES) {
    const titulo = tituloAbaImovel(p);
    assert.ok(titulo.endsWith(textosTotalMensal(p).destaque), `${p.id}: ${titulo}`);
  }
});

test("D7b: plural certo de quartos e banheiros", () => {
  assert.equal(quartosTexto(1), "1 quarto");
  assert.equal(quartosTexto(3), "3 quartos");
  assert.equal(banheirosTexto(1), "1 banheiro");
  assert.equal(banheirosTexto(2), "2 banheiros");
});

test("D8: destaque e 'O que tem por perto' mostram a mesma distância (a mesma lista visível)", () => {
  for (const p of SAMPLE_PROPERTIES) {
    const lista = proximidadesVisiveis(proximidadesDoImovel(p));
    for (const d of destaquesDoImovel(p)) {
      if (d.chave !== "saude" && d.chave !== "educacao") continue;
      const item = lista.find((x) => x.categoria === d.chave && d.titulo === `Perto de ${x.nome}`);
      assert.ok(item, `${p.id}: destaque sem item na lista`);
      assert.equal(d.detalhe, item.texto, `${p.id}: ${d.titulo}`);
    }
  }
});

test("D9: todo exemplo com espaço de trabalho informado tem 'O que tem por perto'; distância vem do dado", () => {
  for (const id of ["ube-007", "ube-012", "ube-014"]) {
    const p = SAMPLE_PROPERTIES.find((x) => x.id === id)!;
    const lista = proximidadesDoImovel(p);
    assert.ok(lista.length > 0, `${id} sem proximidades`);
    const w = p.nearbyWorkspaces[0];
    assert.equal(lista[0].name, w.name);
    assert.equal(lista[0].distanciaM, w.distanceM);
  }
  assert.deepEqual(proximidadesDoImovel({ ...SAMPLE_PROPERTIES[0], proximities: [], nearbyWorkspaces: [] }), []);
});

test("D11: dia passado e dia indisponível são estados diferentes", () => {
  const o = { fromISO: "2026-10-20", untilISO: "2026-11-30", bloqueados: new Set(["2026-10-25"]), hojeISO: "2026-10-17" };
  assert.equal(estadoDiaCalendario("2026-10-10", o), "passado");
  assert.equal(estadoDiaCalendario("2026-10-18", o), "indisponivel"); // antes do início do anúncio
  assert.equal(estadoDiaCalendario("2026-10-25", o), "indisponivel"); // fechado pelo dono
  assert.equal(estadoDiaCalendario("2026-12-01", o), "indisponivel"); // depois do fim
  assert.equal(estadoDiaCalendario("2026-10-22", o), "disponivel");
});

test("ube-005: a internet do 'Espaço de trabalho' não contradiz os destaques (ordem f28ae366, complemento)", () => {
  for (const p of SAMPLE_PROPERTIES) {
    const fibra = (p.workFeatures ?? []).some((w) => /fibra/i.test(w));
    if (fibra && p.internetTier) {
      assert.notEqual(p.internetTier, "basica", `${p.id}: destaque diz fibra, seção diz "${INTERNET_META[p.internetTier].anuncio}"`);
    }
  }
});
