/* Roda: node --test src/components/account/e372-dados-telefone-cpf.test.ts
  E372: (1) o telefone não fica editável nem o formulário salva antes de os dados gravados chegarem (risco de apagar o telefone real);
  (2) o CPF não é "pedido" duas vezes: o campo de Meus dados só mostra, e o caminho aponta para o bloco Documento. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("src/components/account/conta-secoes.tsx", "utf8");
const dados = src.slice(src.indexOf("export function DadosPessoais"), src.indexOf("export function", src.indexOf("export function DadosPessoais") + 10));

test("E372: o telefone nasce travado ('Carregando…') e o salvar espera os dados gravados", () => {
  assert.match(dados, /const \[dadosCarregados, setDadosCarregados\] = useState\(false\);/);
  assert.match(dados, /setDadosCarregados\(true\);/);
  assert.match(dados, /if \(!dadosCarregados\) return;/);
  assert.match(dados, /placeholder=\{dadosCarregados \|\| dadosFalharam \? "\(34\) 99999-0000 ou \+1 …" : "Carregando…"\}\s+disabled=\{!dadosCarregados\}/);
  // E796 (asserção alterada): o salvar também espera a data de nascimento gravada (mesma regra do telefone).
  assert.match(dados, /disabled=\{salvando \|\| !dadosCarregados \|\| \(!nascCarregado && !nascFalhou\)\} data-testid="dados-salvar"/);
});

test("E372: Meus dados não diz mais 'Informar CPF' (o CPF é pedido uma vez, no bloco Documento)", () => {
  assert.doesNotMatch(dados, /Informar \{pj \? "CNPJ" : "CPF"\}/);
  assert.match(dados, /data-testid="dados-documento-aviso"/);
  assert.match(dados, /bloco Documento, abaixo/);
  assert.match(src, /<Panel title=\{pj \? "Documento da empresa \(CNPJ\)" : "Documento \(CPF\)"\}/);
});
