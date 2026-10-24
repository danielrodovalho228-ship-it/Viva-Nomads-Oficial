/*
  E73 — faixa de números-chave do /admin no celular. Roda: node --test src/lib/admin/faixa-celular.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { faixaNumerosCelular } from "./faixa-celular.ts";

test("quatro números, os mesmos da visão geral, cada um com a lista que conta", () => {
  const f = faixaNumerosCelular({ imoveis_ativos: 12, usuarios: 1530, pedidos_ativos: "7" }, { x_atd_abertos_agora: 2 }, null);
  assert.deepEqual(f.map((n) => [n.rotulo, n.valor]), [["Imóveis no ar", "12"], ["Usuários cadastrados", "1.530"], ["Pedidos ativos", "7"], ["Chamados abertos", "2"]]);
  assert.equal(f[0].href, "/admin/imoveis?tipo=real&status=active");
  assert.equal(f[3].href, "/admin/atendimento?aba=fila");
});

test("sem dado é '—' (nunca 0 inventado); a cidade vai para as listas que têm cidade", () => {
  const f = faixaNumerosCelular({}, {}, "Uberlândia");
  assert.ok(f.every((n) => n.valor === "—"));
  assert.match(f[0].href, /&cidade=Uberl%C3%A2ndia$/);
  assert.match(f[2].href, /&cidade=Uberl%C3%A2ndia$/);
  assert.doesNotMatch(f[1].href, /cidade/);
});

test("a tela: faixa só no celular e no topo, antes das decisões; o computador segue igual", () => {
  const pagina = readFileSync(new URL("../../app/(dashboard)/admin/page.tsx", import.meta.url), "utf8");
  assert.ok(pagina.indexOf("<FaixaNumerosCelular") < pagina.indexOf("<DecisoesHoje"));
  const faixa = readFileSync(new URL("../../components/admin/faixa-numeros-celular.tsx", import.meta.url), "utf8");
  assert.match(faixa, /lg:hidden/);
});
