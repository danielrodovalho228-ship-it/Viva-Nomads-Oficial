/*
  Ordem 7436a29a, item 5: linha no topo do /admin quando há chamado real com SLA estourado
  ou esperando a equipe há 2 h ou mais.
  Roda: node --test src/lib/atendimento/aviso-topo-admin.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avisoTopoAdmin } from "./aviso-topo-admin.ts";

test("sem chamado atrasado: nenhuma linha", () => {
  assert.equal(avisoTopoAdmin({ estourados: 0, semRespostaDaEquipe: 0 }), null);
});

test("SLA estourado: singular e plural, com link para a fila", () => {
  const um = avisoTopoAdmin({ estourados: 1, semRespostaDaEquipe: 0 });
  assert.match(um!.texto, /1 chamado com prazo estourado/);
  assert.equal(um!.href, "/admin/atendimento");
  assert.match(avisoTopoAdmin({ estourados: 3, semRespostaDaEquipe: 0 })!.texto, /3 chamados com prazo estourado/);
});

test("esperando a equipe há 2 h ou mais entra na mesma linha", () => {
  const a = avisoTopoAdmin({ estourados: 2, semRespostaDaEquipe: 1 });
  assert.match(a!.texto, /2 chamados com prazo estourado/);
  assert.match(a!.texto, /1 sem resposta da equipe há 2 h ou mais/);
  assert.match(avisoTopoAdmin({ estourados: 0, semRespostaDaEquipe: 4 })!.texto, /4 chamados sem resposta da equipe há 2 h ou mais/);
});

test("números inválidos viram zero", () => {
  assert.equal(avisoTopoAdmin({ estourados: -2, semRespostaDaEquipe: Number.NaN }), null);
});

test("a visão geral do /admin mostra a linha, só com chamados reais", () => {
  const page = readFileSync(new URL("../../app/(dashboard)/admin/page.tsx", import.meta.url), "utf8");
  assert.match(page, /AvisoAtendimentoAdmin/);
  const comp = readFileSync(new URL("../../components/admin/aviso-atendimento.tsx", import.meta.url), "utf8");
  assert.match(comp, /\.eq\("simulacao", false\)/);
  assert.match(comp, /chamadosEsperandoEquipe/);
  assert.match(comp, /role="alert"/);
});
