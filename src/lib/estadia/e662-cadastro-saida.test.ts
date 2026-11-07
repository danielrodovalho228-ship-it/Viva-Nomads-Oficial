import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODELOS } from "../respostas/regras.ts";

// E662 (tela, cadastro do imóvel): o dono escreve a instrução ÚNICA de saída na edição do imóvel; só a coluna instrucao_saida.
const acao = readFileSync("src/lib/data/estadia-actions.ts", "utf8");
const cliente = readFileSync("src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx", "utf8");
const pagina = readFileSync("src/app/(dashboard)/dashboard/imoveis/[id]/editar/page.tsx", "utf8");
const fn = acao.slice(acao.indexOf("export async function salvarInstrucaoSaidaDoImovel"), acao.indexOf("// ── Ocupantes"));

test("ação: só o dono grava e só a coluna da instrução de saída (upsert por imóvel)", () => {
  assert.match(fn, /owner_id\?: string \} \| null\)\?\.owner_id !== user\.id\) return \{ ok: false, erro: "Só o proprietário edita a instrução de saída\." \}/);
  assert.match(fn, /\.upsert\(\{ property_id: propertyId, instrucao_saida: normalizarInstrucaoSaida\(texto\), atualizado_em:/);
  assert.doesNotMatch(fn, /createAdminClient/);
  assert.match(fn, /INSTRUCAO_SAIDA_MAX/);
});

test("edição do imóvel: seção 'Como sair (check-out)' com o texto atual e o aviso da regra do condomínio", () => {
  assert.match(cliente, /<SecaoInstrucaoSaida propertyId=\{property\.id\} inicial=\{instrucaoSaidaInicial\} demo=\{demo\} \/>/);
  assert.match(cliente, /title="Como sair \(check-out\)" testid="secao-instrucao-saida"/);
  assert.match(cliente, /Se o condomínio tem regra própria de devolução, escreva-a aqui, no mesmo texto/);
  // A tabela privada só é lida por leitores da estadia (guarda de chegada-e-pedido): a página chama o leitor, não a tabela.
  assert.match(pagina, /instrucaoSaida = await instrucaoSaidaParaEditar\(supabase, id\)/);
  assert.doesNotMatch(pagina, /imovel_instrucoes_chegada/);
  assert.match(pagina, /instrucaoSaidaInicial=\{instrucaoSaida\}/);
});

test("o modelo da mensagem do dia da saída aponta para a instrução de saída da página da estadia", () => {
  assert.match(MODELOS.saida.texto, /instrução de saída e a conferência de saída estão na página da estadia/);
});
