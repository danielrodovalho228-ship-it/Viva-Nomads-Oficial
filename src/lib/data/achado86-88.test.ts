/*
  Varredura de erros e estados vazios (rodada 17) — leitura que falha nunca vira 404, "vazio" ou "não enviado".
  Achado 86: getContratoParaEquipe engolia o erro → o contrato aberto pela equipe dava 404 "não encontrado".
  Achado 87: detalheDoPedido engolia o erro de 7 leituras → pedido de serviço com conversa/entregas/avaliações vazias.
  Achado 88: meuVinculo engolia o erro → a triagem do morador dizia "não enviado" e pedia o comprovante de novo.
  (Registrado para rodada própria: strikesDoDono — na emissão do laudo, lançar no meio deixaria o laudo sem o strike;
  VISTORIA_ATIVA desligada em produção.)
  Roda: node --test src/lib/data/achado86-88.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("achado 86: o contrato da equipe lança na falha (admin/error.tsx), nunca 404", () => {
  const s = ler("src/lib/data/contrato-assinar-actions.ts");
  const fn = s.slice(s.indexOf("export async function getContratoParaEquipe"));
  assert.match(fn, /const \{ data, error \} = await admin\.from\("contratos"\)\.select\(COLUNAS\)/);
  assert.match(fn, /if \(error\) throw new Error\("Não foi possível ler o contrato agora\."\);\s*if \(!data\) return null;/);
});

test("achado 87: o pedido de serviço lança se qualquer das 7 leituras falhar", () => {
  const s = ler("src/lib/parceiros/pedido-actions.ts");
  const fn = s.slice(s.indexOf("export async function detalheDoPedido"));
  assert.match(fn, /if \(\[cli, imo, ent, msgs, avs, propostaParceiro, horarioEv\]\.some\(\(r\) => \(r as \{ error\?: unknown \}\)\.error\)\) throw new Error/);
});

test("achado 88: a triagem do morador lança na falha; a tela esconde o bloco (nunca 'não enviado')", () => {
  const s = ler("src/lib/data/triagem-actions.ts");
  assert.match(s, /if \(e1 \|\| e2\) throw new Error\("Não foi possível ler o comprovante agora\."\);/);
  assert.match(ler("src/components/triagem/vinculo-morador.tsx"), /meuVinculo\(\)\s*\.then\(setV\)\s*\.catch\(\(\) => setV\(null\)\)/);
});
