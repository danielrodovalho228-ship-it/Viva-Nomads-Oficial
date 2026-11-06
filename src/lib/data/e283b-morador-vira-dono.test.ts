/*
  E283-B (2ª reprova ao vivo): "morador que vira dono pelo PRIMEIRO rascunho não recebeu o e-mail de boas-vindas de dono (nenhum em 35+ min)".
  Diagnóstico (produção, só leitura, 06/11): o gatilho do #1630 só envia quando a intenção estava VAZIA. Conta que já respondeu "morar" (ou
  qualquer coisa) ANTES de o boas-vindas existir fica com intenção ["morar"], vira dono pelo 1º rascunho (intenção → ["morar","anunciar"])
  e não recebe NADA: é o caso de cadastro1@vivanomads.com.br (1º rascunho em 01/11, intenção ["morar","anunciar"], sem a chave
  boas_vindas:<conta> em automacoes_envios — nunca recebeu boas-vindas nenhum). A regra "quem já respondeu a tela não ganha segundo
  boas-vindas" só vale para quem JÁ RECEBEU um; quem nunca recebeu e agora vira dono recebe o de dono. O "uma vez por conta" continua na
  chave boas_vindas:<conta> (gravada antes do envio): quem já recebeu o de morador não recebe o de dono.
  Roda: node --test src/lib/data/e283b-morador-vira-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { moradorViraDono, registraIntencaoNova } from "../papel/papel-ativo.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("moradorViraDono: intenção já respondida (sem 'anunciar') que passa a ter 'anunciar'", () => {
  assert.equal(moradorViraDono(["morar"], ["morar", "anunciar"]), true);
  assert.equal(moradorViraDono(["servicos"], ["servicos", "anunciar"]), true);
  assert.equal(moradorViraDono(["morar", "servicos"], ["morar", "servicos", "anunciar"]), true);
});

test("moradorViraDono: os outros casos seguem pelo caminho antigo ou não enviam", () => {
  // intenção vazia: é o caso do registraIntencaoNova (já envia)
  assert.equal(moradorViraDono(null, ["anunciar"]), false);
  assert.equal(moradorViraDono([], ["anunciar"]), false);
  assert.equal(registraIntencaoNova(null, ["anunciar"]), true);
  // já anunciava: nada novo
  assert.equal(moradorViraDono(["anunciar"], ["anunciar"]), false);
  assert.equal(moradorViraDono(["morar", "anunciar"], ["morar", "anunciar"]), false);
  // não virou dono
  assert.equal(moradorViraDono(["morar"], ["morar"]), false);
  assert.equal(moradorViraDono(["morar"], ["morar", "servicos"]), false);
  // lixo
  assert.equal(moradorViraDono("morar", ["anunciar"]), false);
  assert.equal(moradorViraDono(undefined, ["anunciar"]), false);
});

test("o caminho do 1º rascunho envia o boas-vindas de dono ao morador que nunca recebeu (a chave por conta segura a repetição)", () => {
  const src = ler("src/lib/data/intencao-servidor.ts");
  const i = src.indexOf("export async function registrarIntencaoDeAnunciar(");
  const f = src.slice(i, src.indexOf("\n}\n", i) + 2);
  assert.match(src, /import \{ contaNoPrimeiroAcesso, moradorViraDono, registraIntencaoNova \} from "@\/lib\/papel\/papel-ativo";/);
  assert.match(f, /moradorViraDono\(bruto, nova\)/);
  // só depois de gravar a intenção com sucesso, fora do caminho crítico do salvar, e pelo mesmo enviarBoasVindas (que grava a chave primeiro)
  assert.match(f, /const r = await gravarIntencao\(supabase, userId, nova, "owner"\);[\s\S]*if \(r\.ok && moradorViraDono\(bruto, nova\)\) \{[\s\S]*after\(async \(\) => \{[\s\S]*enviarBoasVindas\(admin, userId, nova, "owner"\)/);
  // o "uma vez por conta" não mudou
  const bv = ler("src/lib/notifications/boas-vindas-servidor.ts");
  assert.match(bv, /from\("automacoes_envios"\)\.insert\(\{ chave: CHAVE_BOAS_VINDAS\(usuarioId\)/);
  assert.match(bv, /if \(error\) return false;/);
});

test("gravarIntencao não muda: a tela de intenção segue só com a intenção vazia (sem segundo boas-vindas)", () => {
  const src = ler("src/lib/data/intencao-servidor.ts");
  assert.match(src, /if \(registraIntencaoNova\(a\?\.intencao, intencao\)\) \{/);
  assert.equal(registraIntencaoNova(["morar"], ["morar", "anunciar"]), false);
});
