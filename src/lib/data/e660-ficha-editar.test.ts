/*
  E660 (resíduo) — a ficha "o que tem dentro" também na edição do anúncio PUBLICADO, da MESMA fonte do assistente
  (componente FichaDentroCampos + coluna ficha_dentro + gravação do servidor). Sem toggle novo e sem sobrescrever a
  ficha de anúncio antigo sem o dono mexer. Roda: node --test src/lib/data/e660-ficha-editar.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const editar = ler("src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx");

test("a edição usa o MESMO componente e as MESMAS regras do assistente (fonte única, sem cópia)", () => {
  assert.match(editar, /import \{ FichaDentroCampos \} from "@\/components\/anuncio\/ficha-dentro-campos";/);
  assert.match(editar, /import \{ faltasDaFicha, fichaVazia, type FichaDentro \} from "@\/lib\/ficha-dentro\/ficha-dentro";/);
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx"), /import \{ FichaDentroCampos \} from "@\/components\/anuncio\/ficha-dentro-campos";/);
  // Nada de cama/ar/enxoval reescrito na edição: só o componente.
  assert.doesNotMatch(editar, /TIPOS_CAMA|solteirosJuntam|cozinhaEquipada/);
});

test("existe a seção 'O que tem dentro' com Salvar seção, partindo da ficha gravada no anúncio", () => {
  assert.match(editar, /testid="secao-ficha-dentro"/);
  assert.match(editar, /title="O que tem dentro"/);
  assert.match(editar, /onSave=\{\(\) => saveSection\("ficha"\)\}/);
  assert.match(editar, /const \[fichaBruta, setFichaBruta\] = useState<FichaDentro>\(\(\) => property\.fichaDentro \?\? fichaVazia\(/);
  assert.match(editar, /<FichaDentroCampos ficha=\{ficha\} onChange=\{mudarFicha\} mostrarFaltas=\{fichaMexida\} \/>/);
});

test("a ficha só vai ao servidor depois que o dono mexe (anúncio antigo sem ficha não ganha ficha vazia)", () => {
  assert.match(editar, /fichaDentro: fichaParaEnviar \? ficha : undefined,/);
  assert.match(editar, /const fichaParaEnviar = fichaMexida \|\| \(ajustouQuartos && !!property\.fichaDentro\);/);
  const acoes = ler("src/lib/data/actions.ts");
  assert.match(acoes, /async function gravarFichaDentro[\s\S]*?if \(bruto === undefined\) return;/);
  assert.match(acoes, /await gravarFichaDentro\(supabase, user\.id, id, input\.fichaDentro\);/);
});

test("o número de quartos de 'Detalhes & preço' manda na ficha (como no assistente)", () => {
  assert.match(editar, /const quartosDoAnuncio = Math\.max\(1, Number\(bedrooms\) \|\| 1\);/);
  assert.match(editar, /const ajustouQuartos = fichaBruta\.quartos\.length !== quartosDoAnuncio;/);
  assert.doesNotMatch(editar, /useEffect\(\(\) => \{\s*if \(ficha\./);
});

test("a edição não bloqueia salvar por ficha incompleta (a obrigatoriedade é só do anúncio novo)", () => {
  assert.doesNotMatch(editar, /fichaCompleta/);
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx"), /!asDraft && !editingId && !fichaCompleta\(fichaParaPublicar\)/);
});
