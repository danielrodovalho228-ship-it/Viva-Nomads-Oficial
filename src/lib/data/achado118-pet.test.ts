/*
  Frente 1, rodada 1 — achado 118 (média, LGPD): removerPet lia as fotos e a carteira de vacina sem conferir o erro.
  Na falha, apagava a linha do pet e deixava os arquivos no Storage (órfãos, sem dono para apagar depois). As outras
  ações da ficha diziam "Pet não encontrado" para um pet que existe. Agora a falha recusa com "Tente de novo".
  Roda: node --test src/lib/data/achado118-pet.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./pets-ficha-actions.ts", import.meta.url), "utf8");
const trecho = (de: string) => src.slice(src.indexOf(de), src.indexOf("\nexport ", src.indexOf(de) + 1));

test("a leitura do pet devolve 'falhou' na falha (nunca 'não encontrado')", () => {
  const f = src.slice(src.indexOf("async function donoDoPet"), src.indexOf("/** Foto do pet"));
  assert.match(f, /if \(error\) return "falhou";\s*if \(!data\) return null;/);
});

test("remover o pet não apaga a linha sem saber os arquivos; as outras ações recusam também", () => {
  const remover = trecho("export async function removerPet");
  const guarda = remover.indexOf('if (dono === "falhou") return { ok: false, error: MSG_PET_SEM_LEITURA };');
  assert.ok(guarda > 0 && guarda < remover.indexOf(".delete()"), "a guarda vem antes de apagar a linha");
  for (const de of ["export async function enviarImagemPet", "export async function removerImagemPet"]) {
    assert.match(trecho(de), /if \(dono === "falhou"\) return \{ ok: false, error: MSG_PET_SEM_LEITURA \};/, de);
  }
});
