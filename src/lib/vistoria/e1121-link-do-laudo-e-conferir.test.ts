/*
  E1121 (ORDEM-DUET-523) — o caminho de leitura do laudo a partir da Central. Na ronda, o laudo aparecia em "Laudos
  recentes", o link respondia {"error":"Não encontrado."} à conta observadora e o /conferir não mostrava nível,
  resultado nem hash. A trava de tela é a tests/e2e/specs/t1743-e1121-link-do-laudo-e-conferir.spec.ts; aqui fica o que
  se prova sem navegador, nos dois lados:
   LINK   1. quem lê o PDF: o dono, o avaliador do laudo e o admin com as duas etapas — e mais ninguém;
          2. a rota decide a permissão com a mesma regra que abre a Central (ehAdmin) e lê pelo servidor; cada 404
             deixa um motivo no log, e a resposta é a mesma em todos;
   PÁGINA 3. o /conferir do laudo mostra o nível, o resultado e o hash, e deixa conferir o arquivo; os outros
             documentos ficam como estavam;
          4. a página lê do laudo só o nível e o resultado; a lista do que a conferência devolve diz o que há de novo.
  Roda: node --test src/lib/vistoria/e1121-link-do-laudo-e-conferir.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { motivoSemLaudo, podeLerLaudo } from "./leitura-do-laudo.ts";
import { CONFERENCIA_DEVOLVE, ROTULO_HASH_DO_ARQUIVO, aceitaArquivo, camposDoLaudo, camposExibidos, ehLaudoDeAvaliacao, hashExibido, type LinhaConferida } from "../fiscal/conferir.ts";

const RAIZ = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const ROTA = ler("src/app/api/vistoria/laudo/[id]/route.ts");
const PAGINA = ler("src/app/(public)/conferir/[codigo]/page.tsx");
const CENTRAL = ler("src/app/(dashboard)/admin/avaliadores/page.tsx");
const HASH = "a".repeat(64);
const laudo: LinhaConferida = {
  prefixo: "VIS", tipo: "laudo_avaliacao", numero: "VIS-2026-000002", versao: 1, status: "valido", anulado_motivo: null, status_em: null,
  emitido_em: "2026-11-22T12:00:00Z", hash_sha256: HASH, is_teste: true, registro_seq: 9, versao_vigente: 1,
};

test("E1121 link 1: leem o PDF o dono, o avaliador do laudo e o admin com as duas etapas; mais ninguém", () => {
  const base = { dono: "dono", contaDoAvaliador: "avaliador" };
  assert.equal(podeLerLaudo({ ...base, leitor: "dono", admin: false }), true);
  assert.equal(podeLerLaudo({ ...base, leitor: "avaliador", admin: false }), true);
  // A observadora da QA é admin com o código do app: lê, como lê a lista da Central.
  assert.equal(podeLerLaudo({ ...base, leitor: "observadora", admin: true }), true);
  assert.equal(podeLerLaudo({ ...base, leitor: "outro", admin: false }), false);
  assert.equal(podeLerLaudo({ ...base, leitor: "", admin: false }), false);
  // Laudo sem dono ou sem avaliador gravado não abre para quem não tem conta ("" e null nunca casam).
  assert.equal(podeLerLaudo({ leitor: "outro", dono: null, contaDoAvaliador: null, admin: false }), false);
  // O motivo do 404, na ordem em que a rota pára.
  assert.equal(motivoSemLaudo({ existe: false, pode: false, temCaminho: false, baixou: false }), "sem_laudo");
  assert.equal(motivoSemLaudo({ existe: true, pode: false, temCaminho: true, baixou: false }), "sem_permissao");
  assert.equal(motivoSemLaudo({ existe: true, pode: true, temCaminho: false, baixou: false }), "sem_arquivo");
  assert.equal(motivoSemLaudo({ existe: true, pode: true, temCaminho: true, baixou: false }), "arquivo_ausente");
  assert.equal(motivoSemLaudo({ existe: true, pode: true, temCaminho: true, baixou: true }), null);
});

test("E1121 link 2: a rota decide a permissão com a regra da Central e lê pelo servidor; todo 404 deixa o motivo no log", () => {
  // O link da Central aponta para esta rota.
  assert.match(CENTRAL, /<a href=\{`\/api\/vistoria\/laudo\/\$\{l\.id\}`\}/);
  // Sem sessão não há leitura; a permissão sai da regra única, com o admin pela mesma conferência do /admin.
  assert.match(ROTA, /if \(!user\) return naoEncontrado\(\);/);
  assert.match(ROTA, /podeLerLaudo\(\{ leitor: user\.id, dono: l\.owner_id as string \| null, contaDoAvaliador, admin: await ehAdmin\(supabase, user\.id\) \}\)/);
  // A linha do laudo é lida pelo servidor (não mais pela sessão da pessoa, que podia negar o que a Central mostra).
  assert.match(ROTA, /await admin\s*\.from\("vistoria_laudos"\)/);
  assert.doesNotMatch(ROTA, /supabase\.from\("vistoria_laudos"\)/);
  // O arquivo só é pedido ao bucket DEPOIS da permissão.
  assert.match(ROTA, /const arquivo = pode && l\?\.pdf_path \? await admin\.storage\.from\("avaliacao-imovel"\)\.download\(/);
  // Um motivo por 404 no log, e a mesma resposta para todos (a rota não diz se o laudo existe).
  assert.match(ROTA, /console\.warn\(`\[laudo\] 404 \$\{motivo\} laudo=\$\{id\}`\);\s*return naoEncontrado\(\);/);
  assert.equal((ROTA.match(/error: "Não encontrado\."/g) ?? []).length, 1, "um só corpo de 404");
  assert.doesNotMatch(ROTA, /console\.(warn|error)\([^)]*user\.id/, "o log não leva id de pessoa");
});

test("E1121 página 3: o /conferir do laudo mostra nível, resultado e hash e deixa conferir o arquivo; os outros documentos ficam como estavam", () => {
  assert.equal(ehLaudoDeAvaliacao("VIS"), true);
  assert.equal(ehLaudoDeAvaliacao("REC"), false);
  assert.deepEqual(camposDoLaudo({ nivel: "Conforto", resultado: "Aprovado" }), [["Nível", "Conforto"], ["Resultado", "Aprovado"]]);
  // Reprovado não sustenta nível: a linha do nível não aparece vazia.
  assert.deepEqual(camposDoLaudo({ nivel: null, resultado: "Reprovado" }), [["Resultado", "Reprovado"]]);
  assert.deepEqual(camposDoLaudo(null), []);
  // O hash por extenso: só no laudo, e só um SHA-256 inteiro.
  assert.equal(hashExibido(laudo), HASH);
  assert.equal(hashExibido({ ...laudo, hash_sha256: null }), null);
  assert.equal(hashExibido({ ...laudo, hash_sha256: "abc" }), null);
  assert.equal(hashExibido({ ...laudo, prefixo: "REC" }), null);
  assert.equal(ROTULO_HASH_DO_ARQUIVO, "Hash do arquivo (SHA-256)");
  // O arquivo do laudo confere-se na página, como o do recibo.
  assert.equal(aceitaArquivo("VIS"), true);
  assert.ok(aceitaArquivo("REC") && !aceitaArquivo("ORC"));
  // As linhas de sempre não mudaram (o laudo ganha linhas a mais, não troca as que havia).
  assert.deepEqual(camposExibidos(laudo, () => "22/11/2026").map(([k]) => k), ["Documento", "Número", "Versão", "Emitido em"]);
});

test("E1121 página 4: a página lê do laudo só o nível e o resultado, e a lista do que a conferência devolve diz o que há de novo", () => {
  assert.match(PAGINA, /\[\.\.\.camposExibidos\(doc, emitidoEmBrasilia\), \.\.\.camposDoLaudo\(laudo\)\]\.map\(/);
  assert.match(PAGINA, /data-testid="conferir-hash">\s*\{hash\}/);
  // Só o laudo de avaliação consulta a tabela, e só por duas colunas — nem dono, nem avaliador, nem imóvel.
  assert.match(PAGINA, /if \(!ehLaudoDeAvaliacao\(doc\.prefixo\)\) return null;/);
  assert.match(PAGINA, /\.from\("vistoria_laudos"\)\.select\("resultado, nivel_sustentado"\)\.eq\("numero", doc\.numero\)\.eq\("versao", doc\.versao\)/);
  assert.equal((PAGINA.match(/\.from\(/g) ?? []).length, 1, "uma leitura de tabela só");
  assert.match(CONFERENCIA_DEVOLVE.join(" | "), /laudo de avaliação do imóvel: o nível, o resultado e o hash do arquivo/);
});
