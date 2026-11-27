/*
  Auditoria de erros/estados vazios (rodada 2). O Início já avisava quando propostas, estadias, candidaturas, mensagens, buscas e a
  conta não eram lidas (achado 24). Três leituras ficaram de fora e mostravam zero sem aviso: os anúncios do dono, os interessados e as
  decisões (contratos, visitas, solicitações, pendências). Agora entram no mesmo aviso.
  Roda: node --test src/lib/painel/inicio-sem-leitura-completo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avisoInicioSemLeitura } from "./sem-leitura.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("o aviso do Início nomeia anúncios, interessados e decisões quando não foram lidos", () => {
  assert.match(avisoInicioSemLeitura(["imoveis"])!, /seus anúncios/);
  assert.match(avisoInicioSemLeitura(["interessados"])!, /os interessados/);
  assert.match(avisoInicioSemLeitura(["decisoes"])!, /contratos, visitas, solicitações e pendências/);
  const junto = avisoInicioSemLeitura(["imoveis", "interessados", "decisoes"])!;
  assert.match(junto, /seus anúncios, os interessados e contratos, visitas, solicitações e pendências/);
  assert.equal(avisoInicioSemLeitura([]), null);
});

test("a página lê as três com exigir e as manda para o aviso (nenhuma vira zero calado)", () => {
  const pagina = ler("src/app/(dashboard)/dashboard/inicio-dados.tsx");
  assert.match(pagina, /ou\("imoveis", listMyProperties\(\{ exigir: true \}\)/);
  assert.match(pagina, /ou\("interessados", interessadosDoDono\(\)/);
  assert.match(pagina, /ou\("decisoes", dadosDasDecisoes\(\{ exigir: true \}\)/);
  assert.doesNotMatch(pagina, /^\s*listMyProperties\(\),$/m);
  assert.match(pagina, /if \(error\) throw new Error\("Não foi possível ler os interessados agora\."\)/);
});

test("dadosDasDecisoes: com exigir, consulta que falha ou exceção LANÇA; sem exigir, mantém VAZIO", () => {
  const f = ler("src/lib/data/painel-decisoes.ts");
  assert.match(f, /export async function dadosDasDecisoes\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(f, /if \(opcoes\.exigir\) \{\n\s+const falhou = \[cDono, cMorador, vDono, vMorador, ordens, leads, adequacao, pDono, pMorador, fotosRec\]/);
  assert.match(f, /catch \(e\) \{\n\s+if \(opcoes\.exigir\) throw e;\n\s+return VAZIO;/);
  assert.match(f, /export const VAZIO/);
});
