/*
  Varredura de erros e estados vazios (rodada 18) — leitura que falha nunca vira "vazio" que decide ou apaga algo.
  Achado 89: nivelGravado/ruído engoliam o erro → a conferência de entrada validava com a lista "essencial" (menos itens).
  Achado 90: contratoDaProgramada engolia o erro → no envio, "sem contrato" CANCELAVA a mensagem do dono para sempre;
             a tela mostrava "nada programado" e salvar o modelo sobrescrevia o texto do dono.
  Achado 91: getTelefoneEstado engolia o erro → "não verificado"; pedir o código de novo zera o selo de verdade.
  Roda: node --test src/lib/data/achado89-91.test.ts
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

test("achado 89: nível e ruído lançam; a conferência recusa com a lista menor; o recálculo segue sem o 'antes'", () => {
  const srv = ler("src/lib/niveis/servidor.ts");
  assert.match(fn(srv, "export async function nivelGravado"), /if \(error\) throw new Error\(MSG_NIVEL_SEM_LEITURA\);/);
  assert.match(fn(srv, "export async function adicionaisDaConferencia"), /if \(ruido\.error\) throw new Error\(MSG_NIVEL_SEM_LEITURA\);/);
  assert.match(fn(srv, "export async function recalcularNivel"), /const antes = await nivelGravado\(admin, propertyId\)\.catch\(\(\) => null\);/);
  const acoes = fn(ler("src/lib/data/conferencia-actions.ts"), "export async function responderConfortoEntrada");
  assert.match(acoes, /adicionaisDaConferencia\(admin, ctx\.propertyId\)\.catch\(\(\) => null\);\s*if \(!adicionais\) return erro\(/);
  assert.match(acoes, /validarSecaoConforto\(input\.respostas, adicionais\)/);
});

test("achado 90: contrato da programada lança (o envio pula, não cancela); tela e ações não decidem no escuro", () => {
  const srv = ler("src/lib/respostas/servidor.ts");
  assert.match(fn(srv, "export async function contratoDaProgramada"), /if \(error\) throw new Error\(/);
  // No envio, o lançamento cai no try/catch do laço (registra e segue) — nunca no "cancelar".
  assert.match(fn(srv, "export async function enviarProgramadas"), /try \{\s*if \(!contratos\.has\(p\.contrato_id\)\) contratos\.set\(p\.contrato_id, await contratoDaProgramada/);
  const a = ler("src/lib/data/respostas-actions.ts");
  assert.match(fn(a, "export async function programadasDaEstadia"), /if \(error\) throw new Error\("Não foi possível ler as mensagens programadas\."\);/);
  const prog = fn(a, "export async function programarMensagem");
  assert.match(prog, /contratoDoDono\(contratoId\)\.catch\(\(\) => "falhou" as const\);\s*if \(r === "falhou"\) return \{ ok: false, erro: MSG_PROGRAMADAS_SEM_LEITURA \};/);
  assert.match(prog, /if \(erroAtual\) return \{ ok: false, erro: MSG_PROGRAMADAS_SEM_LEITURA \};/);
  assert.match(fn(a, "export async function cancelarMensagemProgramada"), /if \(r === "falhou"\) return \{ ok: false, erro: MSG_PROGRAMADAS_SEM_LEITURA \};/);
});

test("achado 91: o estado do celular lança na falha; as telas já tratam (Em breve / bloco escondido)", () => {
  const t = fn(ler("src/lib/data/telefone-actions.ts"), "export async function getTelefoneEstado");
  assert.match(t, /if \(e1 \|\| e2\) throw new Error\(/);
  assert.match(ler("src/components/account/conta-blocos.tsx"), /getTelefoneEstado\(\)[\s\S]{0,300}\.catch\(\(\) => vivo && setCelular\(\{ disponivel: false, verificado: false \}\)\)/);
  assert.match(ler("src/components/account/telefone-verificacao.tsx"), /\.catch\(\(\) => vivo && setEstado\(null\)\);/);
  assert.match(ler("src/lib/data/perfil-actions.ts"), /getTelefoneEstado\(\)\.catch\(\(\) => null\)/);
});
