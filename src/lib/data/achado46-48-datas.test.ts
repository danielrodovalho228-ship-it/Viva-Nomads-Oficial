/*
  Varredura de erros e estados vazios (rodada 4) — as datas ocupadas nunca viram "tudo livre" quando a leitura falha.
  Achado 46: periodosOcupados engolia o erro → conflitoNoImovel dizia "sem conflito" e o aceite de candidatura ou de
             proposta passava por cima de um contrato (o EXCLUDE da 0176 só recusa no contrato, depois do aceite).
  Achado 47: getBlocks engolia o erro → o calendário do dono aparecia sem bloqueios (o aviso "falhou" nunca disparava).
  Achado 48: o calendário público (getDatasIndisponiveis) engolia as duas falhas → todas as datas livres, em silêncio.
  Roda: node --test src/lib/data/achado46-48-datas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("achado 46: periodosOcupados lança na falha; conflitoNoImovel bloqueia com mensagem, nunca 'sem conflito'", () => {
  const s = ler("src/lib/data/periodo-servidor.ts");
  const ocup = s.slice(s.indexOf("export async function periodosOcupados"), s.indexOf("export const MSG_DATAS_SEM_CONFERIR"));
  assert.match(ocup, /const \{ data, error \} = await q;\s*(\/\/.*\n\s*)*if \(error\) throw new Error/);
  const conf = s.slice(s.indexOf("export async function conflitoNoImovel"));
  assert.match(conf, /await periodosOcupados\(admin, propertyId, ignorarContratoId\)\.catch\(\(\) => null\);\s*if \(!ocupados\) return MSG_DATAS_SEM_CONFERIR;/);
  assert.match(s, /MSG_DATAS_SEM_CONFERIR = "Não foi possível conferir as datas do imóvel agora\. Tente de novo em instantes\."/);
  // Os três aceites seguem usando a checagem e param quando ela devolve texto.
  for (const f of ["src/lib/data/actions.ts", "src/lib/data/leads-actions.ts", "src/lib/data/propostas-actions.ts"])
    assert.match(ler(f), /const conflito = await conflitoNoImovel\([\s\S]{0,200}?\);\s*if \(conflito\) return \{ ok: false, error: conflito \};/, f);
});

test("achado 47: getBlocks lança na falha de leitura (o calendário do dono já mostra o aviso quando lança)", () => {
  const s = ler("src/lib/data/blocks-actions.ts");
  const fn = s.slice(s.indexOf("export async function getBlocks"), s.indexOf("export async function getDatasIndisponiveis"));
  assert.match(fn, /const \{ data, error \} = await supabase/);
  assert.match(fn, /if \(error\) throw new Error\("Não foi possível ler as datas bloqueadas\."\);/);
  // Sem backend ou id de demonstração segue [] (anúncio de exemplo).
  assert.match(fn, /if \(!supabase \|\| !UUID_RE\.test\(propertyId\)\) return \[\];/);
  const cal = ler("src/components/property/block-calendar.tsx");
  assert.match(cal, /getBlocks\(propertyId\)\s*\.then[\s\S]{0,120}?\.catch\(\(\) => \{\s*if \(vivo\) setFalhou\(true\);/);
});

test("achado 48: o calendário público avisa a falha, com Tentar de novo, em vez de mostrar tudo livre", () => {
  const s = ler("src/lib/data/blocks-actions.ts");
  const fn = s.slice(s.indexOf("export async function getDatasIndisponiveis"), s.indexOf("export async function addBlock"));
  assert.doesNotMatch(fn, /\.catch\(\(\) => \[\]\)/);
  const cal = ler("src/components/property/availability-calendar.tsx");
  assert.doesNotMatch(cal, /getDatasIndisponiveis\(property\.id\)[\s\S]{0,120}\.catch\(\(\) => \{\}\)/);
  assert.match(cal, /\.catch\(\(\) => vivo && setDatasFalharam\(true\)\)/);
  assert.match(cal, /data-testid="calendario-datas-falha"/);
  assert.match(cal, /data-testid="calendario-datas-tentar"/);
});
