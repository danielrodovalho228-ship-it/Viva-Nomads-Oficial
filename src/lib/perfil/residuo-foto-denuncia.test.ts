/*
  Resíduo da varredura de funções — reabrirFotoPorDenuncia (baixo): a denúncia "Foto de perfil inadequada" devolve a
  foto atual da pessoa para a revisão, no topo da fila. A leitura do perfil não conferia o erro: na falha, a foto NÃO
  voltava para a revisão e ninguém sabia (o mesmo `false` de "sem foto para reabrir"). Agora a falha LANÇA, e o
  chamado ganha uma nota interna para a equipe reabrir a foto à mão; "sem foto" segue sendo false, sem nota.
  Roda: node --test src/lib/perfil/residuo-foto-denuncia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("a leitura do perfil que falha lança (não é 'sem foto')", () => {
  const s = ler("src/lib/data/fotos-perfil-servidor.ts");
  assert.match(s, /const \{ data: p, error: erroPerfil \} = await admin\.from\("profiles"\)\.select\("avatar_url"\)/);
  assert.ok(s.indexOf("if (erroPerfil) throw new Error(") < s.indexOf("if (caminho !== avatarPath(userId)) return false;"));
});

test("a falha deixa nota interna no chamado; a reabertura segue registrando o evento", () => {
  const a = ler("src/lib/data/atendimento-actions.ts");
  assert.match(a, /const reaberta = await reabrirFotoPorDenuncia\(admin, contextoId\)\.catch\(\(\) => "falhou" as const\);/);
  assert.match(a, /if \(reaberta === true\) await admin\.from\("chamado_eventos"\)\.insert\(\{ chamado_id: c\.id, ator_tipo: "sistema", acao: "foto_reaberta", para: "em_revisao" \}\);/);
  assert.match(a, /if \(reaberta === "falhou"\) \{[\s\S]*?interno: true[\s\S]*?NOTA_FOTO_NAO_REABERTA/);
});
