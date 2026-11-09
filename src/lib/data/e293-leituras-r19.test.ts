/*
  Varredura de erros (rodada 19): três leituras que viravam "nada" em telas logadas.
  • Renovação do contrato: falha ao ler não vira "sem renovação" nem "no máximo da estadia"; a tela diz que não deu para conferir.
  • Pets da candidatura (resumo e ficha): falha ao ler não vira "sem pets" nem "ficha indisponível" — o dono decidiria sem ver o animal.
  Roda: node --test src/lib/data/e293-leituras-r19.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("renovação: o erro de leitura é um estado próprio, mostrado na tela do contrato", () => {
  const s = ler("lib/data/renovacao-contrato.ts");
  assert.match(s, /\{ falhou: true \}/);
  assert.match(s, /const \{ data, error \} = await supabase/);
  assert.match(s, /if \(error\) return \{ falhou: true \};/);
  const t = ler("components/contrato/contrato-detalhe.tsx");
  assert.match(t, /"falhou" in renovacao/);
  assert.match(t, /data-testid="contrato-renovacao-sem-leitura"/);
  assert.match(t, /\{MSG_RENOVACAO_SEM_LEITURA\}/);
});

test("pets da candidatura: pets e anúncio lançam na falha; a tela mostra aviso, não 'sem pets'", () => {
  const s = ler("lib/data/pets-candidatura.ts");
  assert.match(s, /if \(error\) throw new Error\(MSG_PETS_SEM_LEITURA\);/);
  assert.equal((s.match(/if \(erroImovel\) throw new Error\(MSG_PETS_SEM_LEITURA\);/g) ?? []).length, 2);
  const c = ler("components/pets/ficha-pet-candidatura.tsx");
  assert.match(c, /\.catch\(\(\) => \(\{ pets: \[\], quantidade: null, falhou: true \}\)\)/);
  assert.match(c, /data-testid="ficha-pet-sem-leitura"/);
  assert.match(c, /data-testid="ficha-pet-resumo-sem-leitura"/);
  assert.match(ler("lib/anuncio/ficha-pet-dono.ts"), /export const MSG_PETS_SEM_LEITURA/);
  // "use server": só funções async exportadas (a mensagem mora no módulo puro).
  assert.doesNotMatch(s, /^export const /m);
});
