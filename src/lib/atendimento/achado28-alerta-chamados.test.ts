/*
  Achado 28 (frente erros/estados vazios): quando a leitura dos chamados atrasados falha, o aviso
  do topo do /admin e o alerta vermelho da Central de Agentes não podem sumir como se não houvesse atraso.
  Roda: node --test src/lib/atendimento/achado28-alerta-chamados.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_ATRASO_NAO_LIDO } from "./aviso-topo-admin.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("chamadosEsperandoEquipe aceita exigir e lança nas duas leituras", () => {
  const s = ler("./escalonamento.ts");
  assert.match(s, /opcoes: \{ exigir\?: boolean \} = \{\}/);
  assert.match(s, /if \(error && opcoes\.exigir\) throw/);
  assert.match(s, /if \(erroRespostas && opcoes\.exigir\) throw/);
});

test("topo do /admin: falha vira aviso de 'não deu para conferir', nunca zero", () => {
  const c = ler("../../components/admin/aviso-atendimento.tsx");
  assert.match(c, /chamadosEsperandoEquipe\(admin, new Date\(\), \{ exigir: true \}\)/);
  assert.doesNotMatch(c, /\(\) => 0/);
  assert.match(c, /r\.error \? null/);
  assert.match(c, /MSG_ATRASO_NAO_LIDO/);
  assert.match(MSG_ATRASO_NAO_LIDO, /Não foi possível conferir/);
});

test("Central de Agentes: falha vira null e a Central avisa", () => {
  assert.match(ler("../data/agentes-actions.ts"), /chamadosEsperandoEquipe\(admin, new Date\(\), \{ exigir: true \}\)/);
  const page = ler("../../app/(dashboard)/admin/agentes/page.tsx");
  assert.match(page, /chamadosEmVermelho\(\)\.catch\(\(\) => null\)/);
  assert.doesNotMatch(page, /chamadosEmVermelho\(\)\.catch\(\(\) => \[\]\)/);
  const cli = ler("../../app/(dashboard)/admin/agentes/central-client.tsx");
  assert.match(cli, /vermelhos === null && \(/);
  assert.match(cli, /data-testid="chamados-vermelhos-erro"/);
  assert.match(cli, /MSG_ATRASO_NAO_LIDO/);
});

test("o cron de atendimento e o servidor dos agentes seguem sem exigir (não param a rotina)", () => {
  assert.doesNotMatch(ler("../../app/api/cron/atendimento/route.ts"), /exigir/);
});
