/*
  Varredura de erros e estados vazios (rodada 22, lote 2) — leitura que falha nunca vira "não existe" ou perfil vazio.
  Achado 108 (média): visão do convidado → 404 ou endereço em branco na falha.
  Achado 109 (média): Fechamento → "nenhuma candidatura aceita" na falha.
  Achado 110 (baixa): espelho do perfil público → perfil "Você" vazio na falha (a tela já avisa quando lança).
  Achado 111 (média): admin › pedidos de moradia → lista vazia na falha.
  Achado 112 (baixa): montagem da proposta → "Escolha um interessado" na falha.
  Sem ação neste lote (justificado): localDaEstadia (mapa some, sem decisão), estadoDoLocal (cai no ponto salvo,
  dado correto), resolveInitialMode (null = não força nada; o modo local fica), getAlertasEquipe (só esconde a
  chave), colunasPedidosAdmin (quem chama já trata), provaDoItem e medicaoDoPonto (consulta repetida: segue esperando).
  Roda: node --test src/lib/data/achado108-112.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const fn = (s: string, de: string) => {
  const i = s.indexOf(de);
  const j = s.indexOf("\nexport ", i + 1);
  return s.slice(i, j < 0 ? undefined : j);
};

test("achado 108: visão do convidado lança nas duas leituras", () => {
  const f = fn(ler("src/lib/data/estadia-convidados.ts"), "export async function carregarVisaoConvidado");
  assert.match(f, /if \(error\) throw new Error\(MSG_CONVIDADO_SEM_LEITURA\);/);
  assert.match(f, /if \(erroIm\) throw new Error\(MSG_CONVIDADO_SEM_LEITURA\);/);
});

test("achados 109–112: Fechamento, perfil, pedidos do admin e proposta lançam na falha", () => {
  assert.match(fn(ler("src/lib/data/leads-actions.ts"), "export async function getFechamentoContext"), /if \(erroLead\) throw new Error\(/);
  assert.match(fn(ler("src/lib/data/papeis-actions.ts"), "export async function meuPerfilPublico"), /if \(error\) throw new Error\(/);
  assert.match(ler("src/components/account/seu-perfil-publico.tsx"), /\.catch\(\(\) => vivo && setP\(null\)\);/);
  assert.match(fn(ler("src/lib/data/pedidos-admin.ts"), "export async function adminListPedidos"), /if \(error\) throw new Error\(/);
  assert.match(fn(ler("src/lib/data/propostas-actions.ts"), "export async function dadosNovaProposta"), /if \(erroLead\) throw new Error\(/);
});
