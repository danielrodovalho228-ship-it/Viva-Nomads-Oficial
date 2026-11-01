/*
  Auditoria de erros e estados vazios — achado nº 13: em Notificações, a falha das leituras virava "0 manutenções em
  aberto", "nenhuma atualização" e nenhuma proposta para responder. A tela tem também as preferências de aviso, então não
  cai inteira: os avisos dizem que não carregaram ("—" nos contadores, frase no lugar do vazio) e as preferências seguem.
  Roda: node --test src/lib/data/notificacoes-avisos-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("avisosRecentes marca falhou quando a leitura das ordens não vem", () => {
  const src = ler("src/lib/data/manutencao-actions.ts");
  assert.match(src, /Promise<\{ abertas: number; avisos: AvisoRecente\[\]; falhou\?: boolean \} \| null>/);
  assert.match(src, /if \(erroOrdens\) return \{ abertas: 0, avisos: \[\], falhou: true \};/);
});

test("a tela diz que não carregou (contadores com —, frase no lugar do vazio) e não some com as preferências", () => {
  const pg = ler("src/app/(dashboard)/dashboard/notificacoes/page.tsx");
  assert.match(pg, /listarPropostas\(\{ exigir: true \}\)\.catch\(\(\) => null\)/);
  assert.match(pg, /const naoCarregou = todas === null \|\| r\?\.falhou === true;/);
  assert.match(pg, /data-testid="avisos-falha"/);
  assert.match(pg, /value=\{r\?\.falhou \? "—" : \(r\?\.abertas \?\? 0\)\}/);
  assert.match(pg, /value=\{r\?\.falhou \? "—" : avisos\.length\}/);
  assert.match(pg, /avisos\.length === 0 && r\?\.falhou \?/);
  assert.match(pg, /<TelaNotificacoes \/>/);
  assert.doesNotMatch(pg, /MSG_AVISOS_NAO_CARREGARAM = "[^"]*(nenhum|Nenhum)/);
});
