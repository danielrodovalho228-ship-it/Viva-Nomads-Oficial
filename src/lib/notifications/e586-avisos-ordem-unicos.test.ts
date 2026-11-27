/*
  E586 — painel de avisos (reteste de 05/11):
   (a) três avisos IDÊNTICOS "Pedido de moradia compatível com o seu imóvel" para o mesmo dono no mesmo minuto (04/11
       20:25; produção: 3 linhas em avisos com ref_id nulo, a 1–2 s uma da outra, de 2 pedidos compatíveis). A renovação
       do pendente (E550) entrou depois, e ela é "lê e depois grava": dois avisos quase simultâneos passam os dois pela
       leitura. Correção: depois de gravar, o servidor junta os pendentes da MESMA chave (evento + ref, ou evento +
       título) num só — fica o mais antigo, com a hora renovada; os outros saem.
   (b) a lista do painel não era estritamente cronológica: o sino ordenava por prioridade antes da data (um aviso de
       hoje entre avisos de ontem). Agora: data/hora decrescente, desempate estável pelo id; os críticos pendentes
       continuam na faixa do topo (criticosPendentes), não furam a lista.
  Roda: node --test src/lib/notifications/e586-avisos-ordem-unicos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ordemCronologica, ordenarParaOSino } from "./sino.ts";
import { duplicatasDoPendente } from "./avisos.ts";

type A = Parameters<typeof ordenarParaOSino>[0][number];
const av = (id: string, prioridade: A["prioridade"], criado: string): A => ({ id, evento: "x", prioridade, titulo: id, url: null, criado_em: criado, lido_em: null, resolvido_em: null });
const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("(b) o sino lista por data/hora decrescente, sem a prioridade furar a ordem", () => {
  const lista = [
    av("ontem-urgente", "urgente", "2026-11-04T10:00:00Z"),
    av("hoje-normal", "normal", "2026-11-05T02:00:00Z"),
    av("ontem-critico", "critico", "2026-11-04T09:00:00Z"),
    av("anteontem", "normal", "2026-11-03T09:00:00Z"),
  ];
  assert.deepEqual(ordenarParaOSino(lista).map((a) => a.id), ["hoje-normal", "ontem-urgente", "ontem-critico", "anteontem"]);
});

test("(b) desempate estável: mesma hora → mesma ordem, em qualquer ordem de chegada", () => {
  const t = "2026-11-04T23:25:21Z";
  const a = [av("a1", "normal", t), av("b2", "normal", t), av("c3", "normal", t)];
  const esperado = ordemCronologica(a).map((x) => x.id);
  assert.deepEqual(esperado, ["c3", "b2", "a1"]);
  assert.deepEqual(ordemCronologica([...a].reverse()).map((x) => x.id), esperado);
  assert.deepEqual(ordemCronologica([a[1], a[2], a[0]]).map((x) => x.id), esperado);
});

test("(a) pendentes repetidos da mesma chave: fica o mais antigo, os outros saem", () => {
  const linhas = [
    { id: "9b7e", criado_em: "2026-11-04T23:25:21.219Z" },
    { id: "a784", criado_em: "2026-11-04T23:25:22.973Z" },
    { id: "b653", criado_em: "2026-11-04T23:25:24.100Z" },
  ];
  assert.deepEqual(duplicatasDoPendente(linhas), { manter: "9b7e", apagar: ["a784", "b653"] });
  assert.deepEqual(duplicatasDoPendente([...linhas].reverse()), { manter: "9b7e", apagar: ["b653", "a784"] });
  assert.deepEqual(duplicatasDoPendente([linhas[0]]), { manter: "9b7e", apagar: [] });
  assert.equal(duplicatasDoPendente([]), null);
});

test("(a) o servidor junta os pendentes da mesma chave depois de gravar; (b) as leituras desempatam pelo id", () => {
  const g = ler("lib/notifications/avisos-servidor.ts");
  assert.match(g, /await juntarPendentes\(admin, p\.usuarioId, chave\);/);
  assert.match(g, /const d = duplicatasDoPendente\(/);
  assert.match(g, /\.delete\(\)\.in\("id", d\.apagar\)/);
  assert.match(ler("lib/data/avisos-actions.ts"), /\.order\("criado_em", \{ ascending: false \}\)\.order\("id", \{ ascending: false \}\)/);
  assert.match(ler("components/account/lista-avisos.tsx"), /filtrarAvisos\(ordemCronologica\(avisos\), filtro\)/);
});

import { semRepetidos } from "./sino.ts";

test("E586 histórico: três avisos idênticos no mesmo minuto viram um (o mais recente); o resto fica", () => {
  const t = (s: string) => `2026-11-04T23:25:${s}Z`;
  const base = { evento: "pedido_compativel", titulo: "Pedido de moradia compatível com o seu imóvel", url: "/dashboard/pedidos-cidade" };
  const lista = [
    { ...av("9b7e", "normal", t("21")), ...base, lido_em: "2026-11-05T01:00:00Z" },
    { ...av("a784", "normal", t("22")), ...base, lido_em: "2026-11-05T01:00:00Z" },
    { ...av("b653", "normal", t("24")), ...base, lido_em: "2026-11-05T01:00:00Z" },
    { ...av("depois", "normal", "2026-11-05T11:00:49Z"), ...base },
    av("outro", "normal", t("23")),
  ];
  const ids = ordemCronologica(lista).map((a) => a.id);
  assert.deepEqual(ids, ["depois", "b653", "outro"]);
  assert.deepEqual(ordenarParaOSino(lista).map((a) => a.id), ids);
  assert.equal(semRepetidos(lista).length, 3);
});

test("E586 histórico: só um do grupo pendente → o pendente fica; a lista segue em ordem decrescente", () => {
  const base = { evento: "x", titulo: "igual", url: null };
  const lista = [
    { ...av("p", "normal", "2026-11-04T10:00:00Z"), ...base },
    { ...av("l", "normal", "2026-11-04T10:00:30Z"), ...base, lido_em: "2026-11-04T11:00:00Z" },
  ];
  assert.deepEqual(semRepetidos(lista).map((a) => a.id), ["p"]);
  const longe = [{ ...av("a", "normal", "2026-11-04T10:00:00Z"), ...base }, { ...av("b", "normal", "2026-11-04T10:10:00Z"), ...base }];
  assert.deepEqual(semRepetidos(longe).map((a) => a.id), ["b", "a"]);
});
