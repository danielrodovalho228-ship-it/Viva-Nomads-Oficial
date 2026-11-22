/*
  E1064, perna 2 (ORDEM-DUET-392) — o Resumo (passo 6) do Fechamento lê o estado REAL do contrato.
  A prova ao vivo de 21/11: com o contrato já assinado, o Fechamento reaberto dizia a situação dele no topo (a perna
  que entrou com o #4086), mas o Resumo continuava inacessível. Causa: o passo só abria com a marca local "contrato
  gerado nesta visita"; a candidatura que JÁ tem contrato nunca chegava lá sem gerar de novo.
  Agora o Resumo abre também pelo contrato que existe, e nesse caso lê o que o contrato guarda (a situação, a data, a
  garantia). O que o contrato NÃO guarda (os serviços adicionais e o seguro patrimonial escolhidos na visita) não
  aparece: a tela não inventa "Nenhum" / "Não contratado" para um contrato já assinado.
  Roda: node --test src/lib/e1064-resumo-le-o-contrato.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fonteDoResumo, nomeDaGarantiaDoContrato, resumoAcessivel } from "./fechamento-resumo.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const contrato = { id: "c1", texto: "Em vigência", criadoEm: "2026-11-20T12:00:00Z", garantia: "caucao" as const };

test("o Resumo abre pelo contrato gerado nesta visita OU pelo contrato que a candidatura já tem", () => {
  assert.equal(resumoAcessivel({ geradoNestaVisita: false, contratoExistente: null, demo: false }), false);
  assert.equal(resumoAcessivel({ geradoNestaVisita: true, contratoExistente: null, demo: false }), true);
  assert.equal(resumoAcessivel({ geradoNestaVisita: false, contratoExistente: contrato, demo: false }), true, "contrato já existe: o Resumo é acessível sem gerar de novo");
  // A demonstração não tem contrato de verdade: continua a abrir só depois de gerar o exemplo.
  assert.equal(resumoAcessivel({ geradoNestaVisita: false, contratoExistente: contrato, demo: true }), false);
  assert.equal(resumoAcessivel({ geradoNestaVisita: true, contratoExistente: contrato, demo: true }), true);
});

test("de onde o Resumo lê: das escolhas desta visita, ou do contrato que já existe", () => {
  assert.equal(fonteDoResumo({ geradoNestaVisita: true, contratoExistente: contrato, demo: false }), "visita", "gerou agora: as escolhas da visita são as do contrato");
  assert.equal(fonteDoResumo({ geradoNestaVisita: false, contratoExistente: contrato, demo: false }), "contrato");
  assert.equal(fonteDoResumo({ geradoNestaVisita: false, contratoExistente: null, demo: false }), null);
});

test("a garantia do Resumo reaberto é a gravada no contrato, com o nome do catálogo", () => {
  assert.equal(nomeDaGarantiaDoContrato("caucao"), "Caução");
  assert.equal(nomeDaGarantiaDoContrato("seguro_fianca"), "Seguro-fiança");
  assert.equal(nomeDaGarantiaDoContrato(null), null, "sem a leitura, a linha não aparece (nunca um valor por omissão)");
  assert.equal(nomeDaGarantiaDoContrato(undefined), null);
});

test("o servidor lê a garantia do contrato existente; a tela abre o Resumo pelo estado real e não inventa linhas", () => {
  const ctx = ler("src/lib/data/leads-actions.ts");
  assert.match(ctx, /\.from\("contratos"\)\.select\("id, garantia"\)/);
  assert.match(ctx, /garantia: garantiaLida/);
  const tela = ler("src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
  assert.match(tela, /resumoAcessivel\(\{ geradoNestaVisita: generated, contratoExistente: ctx\.contratoExistente, demo \}\)/);
  assert.match(tela, /const reachable = i <= maxReached \|\| \(i === PASSO_RESUMO && RESUMO_ACESSIVEL\);/);
  assert.match(tela, /data-testid="fechamento-ver-resumo"/);
  // No Resumo aberto pelo contrato: serviços e seguro patrimonial (que o contrato não guarda) ficam de fora.
  assert.match(tela, /\{FONTE_RESUMO !== "contrato" && \(\s*<>\s*<Row\s+label="Serviços adicionais"/);
  assert.match(tela, /label="Seguro patrimonial"/);
});
