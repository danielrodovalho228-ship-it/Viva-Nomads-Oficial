/*
  E701: página de um papel nunca renderiza dentro do menu do outro (E176). "Meus pedidos" da moradora (/dashboard/pedidos) e
  "Candidaturas" (/dashboard/candidaturas) são páginas SÓ do morador (o menu do dono nem as lista: ROTAS_SO_MORADOR), mas não
  estavam em AREA_MORADOR — então a casca as desenhava pelo modo guardado e, com o modo em proprietário (depois de
  Anunciar), abriam DENTRO da área do proprietário. Agora a URL decide: são área do morador.
  Roda: node --test src/lib/papel/e701-pagina-do-morador-no-menu-do-morador.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { AREA_MORADOR } from "../../config/areas-por-papel.ts";
import { ROTAS_SO_MORADOR } from "../../config/nav-dono.ts";
import { modoDaRota } from "./modo-da-rota.ts";
import { papelDaRota } from "./papel-ativo.ts";

test("Meus pedidos e Candidaturas pertencem à área do morador, qualquer que seja o modo guardado", () => {
  for (const rota of ["/dashboard/pedidos", "/dashboard/candidaturas", "/dashboard/pedidos/abc", "/dashboard/candidaturas/xyz"]) {
    assert.equal(papelDaRota(rota, false), "morador", rota);
    assert.equal(modoDaRota(rota), "tenant", rota);
  }
});

test("toda rota do painel que o menu do dono esconde por ser do morador é área do morador (sem exceção esquecida)", () => {
  for (const rota of ROTAS_SO_MORADOR.filter((r) => r.startsWith("/dashboard/"))) {
    assert.ok(AREA_MORADOR.some((a) => rota === a || rota.startsWith(a + "/")), `${rota} está fora de AREA_MORADOR`);
  }
});

test("'Pedidos na cidade' (do dono) continua do dono: o prefixo /dashboard/pedidos não a captura", () => {
  assert.equal(papelDaRota("/dashboard/pedidos-cidade", false), "proprietario");
  assert.equal(modoDaRota("/dashboard/pedidos-cidade"), "owner");
});
