/*
  Varredura de erros (rodada 26): a ficha do candidato (tela Interessados) não decide com dado que faltou.
  Achado 134: a falha ao ler os pets do candidato virava "sem pets" — o dono aceitaria sem ver o pet. Com `exigir`, lança.
  Achado 135: a falha ao ler o contrato mais recente do candidato deixava a ficha de um contrato ENCERRADO ou CANCELADO
    visível ao dono (é a leitura que a tira). Com `exigir`, lança.
  A tela Interessados já chama `listLeads({ exigir: true })` e mostra "Tentar de novo" (Achado 5); quem não pede segue best-effort.
  Roda: node --test src/lib/data/achado134-135-ficha-candidato.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./leads.ts", import.meta.url), "utf8");

test("Achado 134: os pets do candidato lançam na falha quando a tela pede com exigir", () => {
  assert.match(src, /const \{ data: ps, error: ePets \} = await admin\.from\("pets_inquilino"\)/);
  assert.match(src, /if \(ePets && opcoes\.exigir\) throw new Error\(MSG_INTERESSADOS_NAO_CARREGARAM\);/);
  assert.ok(src.indexOf("if (ePets && opcoes.exigir)") < src.indexOf("pets.set(p.user_id"), "lança antes de montar a ficha");
});

test("Achado 135: o contrato mais recente lança na falha quando a tela pede com exigir", () => {
  assert.match(src, /const \{ data: cs, error: eContratos \} = await admin\s*\n\s*\.from\("contratos"\)/);
  assert.match(src, /if \(eContratos && opcoes\.exigir\) throw new Error\(MSG_INTERESSADOS_NAO_CARREGARAM\);/);
  assert.ok(src.indexOf("if (eContratos && opcoes.exigir)") < src.indexOf("contratoDaCandidatura.has(k)"), "lança antes de decidir quem some");
});

test("a tela Interessados continua pedindo com exigir", () => {
  const pagina = readFileSync(new URL("../../app/(dashboard)/dashboard/leads/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /listLeads\(\{ exigir: true \}\)/);
});
