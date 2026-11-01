/*
  E293 — relatório simulado honesto. Todo item do inventário com prazo DECLARADO precisa de um coletor que conte o que
  venceu, ou de um motivo escrito aqui para não ter. Sem isso, a tela da Retenção mostra "0 vencidos" — um zero falso.
  Roda: node --test src/lib/minimizacao/relatorio-contagem.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INVENTARIO } from "../../config/retencao.ts";

const servidor = readFileSync(new URL("./servidor.ts", import.meta.url), "utf8");

/** Itens com prazo declarado que NÃO precisam de contagem própria — e por quê. */
const SEM_CONTAGEM: Record<string, string> = {
  "internet_medicoes/dono": "sai com o anúncio (on delete cascade); não há linha órfã para contar",
  "anuncio-videos": "bucket: sai com o anúncio",
  "property-photos": "bucket: sai com o anúncio",
  contrato_ocupantes: "o cron do Prompt 32 já apaga aos 90 dias do fim da estadia",
  estadia_convidados: "o cron da estadia já apaga aos 30 dias do fim",
  push_adiados: "apagado ao enviar (rotina das 7h)",
  prova_capturas: "apagado pela rotina dos prazos do 59 ao vencer",
  prova_links_celular: "apagado pela rotina dos prazos do 59 ao vencer",
  proprietario_strikes: "o cron da avaliação apaga pelo expira_em do strike (não pela criação); contar pela criação daria número errado",
};

function temColetor(id: string): boolean {
  const chave = /^[a-z_]+$/.test(id) ? `(?:"${id}"|${id})` : `"${id.replace(/[/-]/g, (c) => `\\${c}`)}"`;
  return new RegExp(`\\n  ${chave}: \\{\\n    async candidatos`).test(servidor);
}

test("E293: todo item com prazo declarado tem contagem no relatório ou motivo escrito para não ter", () => {
  const faltando = INVENTARIO.filter((i) => i.prazoDias !== null)
    .map((i) => i.id)
    .filter((id) => !temColetor(id) && !(id in SEM_CONTAGEM));
  assert.deepEqual(faltando, [], "item novo com prazo sem coletor: some como '0 vencidos' no relatório");
  // A lista de exceções não guarda nome velho.
  for (const id of Object.keys(SEM_CONTAGEM)) assert.ok(INVENTARIO.some((i) => i.id === id), `${id} saiu do inventário`);
});

test("E293: os coletores novos da fase 2 só contam — nunca apagam", () => {
  const bloco = servidor.slice(servidor.indexOf("const COLETORES_FASE_2"), servidor.indexOf("/** Quanto existe hoje"));
  assert.ok(bloco.length > 0);
  assert.doesNotMatch(bloco, /\.delete\(|\.update\(|storage\.from/);
  const ids = [...bloco.matchAll(/\n  (?:"([^"]+)"|([a-z_]+)): \{\n    async candidatos/g)].map((m) => m[1] ?? m[2]);
  assert.deepEqual(ids.sort(), ["denuncias_anuncio", "eventos", "internet_medicoes/morador", "push_envios", "saidas_motivos"]);
  for (const id of ids) {
    const item = INVENTARIO.find((i) => i.id === id)!;
    assert.equal(item.fase, 2, `${id} é fase 2 (só relatório)`);
  }
  assert.equal((bloco.match(/eliminar: soContar,/g) ?? []).length, ids.length);
  assert.match(servidor, /COLETORES\[item\.id\] \?\? COLETORES_FASE_2\[item\.id\]/);
  // A leitura que falha vira alerta do item (não um zero).
  assert.match(bloco, /function lerOuFalhar|lerOuFalhar\(r, /);
  assert.match(servidor, /function lerOuFalhar[\s\S]*?if \(r\.error\) throw new Error/);
});
