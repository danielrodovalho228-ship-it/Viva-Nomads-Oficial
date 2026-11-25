/*
  E1093 (ORDENS 446 e 565) — a casca do painel: "não li" não é "não tem".
  A rota dos contadores respondia 200 com temImovel:false quando a leitura dos imóveis falhava (ou quando a sessão não
  se confirmava): a casca aceitava e a conta de dono perdia o que depende de "tem imóvel" (por exemplo "Modo
  proprietário" no menu da Conta, para a dona que está no modo morador) até outra leitura dar certo. Agora:
   • o servidor diz QUAIS campos do contexto não conseguiu ler (naoLidos). O contexto são os dois campos que dizem
     quem a conta é: tem imóvel (as secções de dono) e é parceiro (as de parceiro). Os números seguem como antes;
   • a casca mantém, nesses campos, o que já sabia, e repete a leitura logo.
  Roda: node --test src/lib/painel/e1093-casca-nao-li-nao-e-nao-tem.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAMPOS_DE_CONTEXTO, CONTADORES_VAZIOS, camposNaoLidos, normalizarContadores } from "./contadores.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const DONA = { ...CONTADORES_VAZIOS, temImovel: true, imoveisAtivos: 2, parceiro: true, estadiaAtiva: true, propostasAguardando: 1 };

test("campo do contexto NÃO lido: a casca fica com o que já sabia (a dona continua dona)", () => {
  const resposta = { ...CONTADORES_VAZIOS, propostasAguardando: 3, naoLidos: ["temImovel"] };
  const c = normalizarContadores(resposta, DONA);
  assert.equal(c.temImovel, true, "o que não foi lido não muda");
  assert.equal(c.propostasAguardando, 3, "o que foi lido entra");
  assert.equal(c.parceiro, false, "campo LIDO como falso vale falso");
  assert.deepEqual(camposNaoLidos(resposta), ["temImovel"]);
});

test("os dois campos do contexto podem vir não lidos; nomes que não são contexto são ignorados", () => {
  assert.deepEqual([...CAMPOS_DE_CONTEXTO], ["temImovel", "parceiro"]);
  const resposta = { naoLidos: [...CAMPOS_DE_CONTEXTO, "imoveisAtivos", "contratosParaAssinar", 7, null] };
  const c = normalizarContadores(resposta, DONA);
  assert.deepEqual([c.temImovel, c.parceiro], [true, true]);
  assert.deepEqual([c.imoveisAtivos, c.estadiaAtiva, c.contratosParaAssinar], [0, false, 0], "número e estadia não são contexto: seguem o que a resposta traz");
  assert.deepEqual(camposNaoLidos(resposta), [...CAMPOS_DE_CONTEXTO]);
});

test("sem valor anterior (1ª leitura), o não lido vale o vazio de sempre — e a casca sabe que precisa reler", () => {
  const resposta = { naoLidos: ["temImovel"] };
  assert.equal(normalizarContadores(resposta).temImovel, false);
  assert.deepEqual(camposNaoLidos(resposta), ["temImovel"]);
});

test("resposta sem naoLidos: tudo igual a antes (o anterior não entra)", () => {
  assert.deepEqual(normalizarContadores({ temImovel: false, imoveisAtivos: 0 }, DONA), { ...CONTADORES_VAZIOS });
  assert.deepEqual(normalizarContadores(null, DONA), CONTADORES_VAZIOS);
  assert.deepEqual(camposNaoLidos({ temImovel: true }), []);
  assert.deepEqual(camposNaoLidos(null), []);
});

test("servidor: o contexto do menu é lido com `exigir`; a leitura que falha entra em naoLidos, não vira falso", () => {
  const s = semComentarios(ler("src/lib/painel/contadores-servidor.ts"));
  assert.match(s, /const user = await usuarioExigido\(supabase\);\s*if \(!user\) return "sem-sessao";/, "sessão por confirmar lança (a rota responde 503), não vira sem-sessão");
  for (const [campo, leitura] of [
    ["temImovel", "temImovelAnunciado({ exigir: true })"],
    ["parceiro", "temPapelParceiro({ exigir: true })"],
  ]) {
    assert.ok(s.includes(`contexto("${campo}", () => ${leitura}`), `${campo}: ${leitura}`);
  }
  assert.doesNotMatch(s, /temImovelAnunciado\(\)\.catch\(\(\) => false\)/);
  assert.doesNotMatch(s, /temPapelParceiro\(\)\.catch\(\(\) => false\)/);
  assert.match(s, /naoLidos\.push\(campo\)/);
  // Todo `exigir` desta função está dentro de contexto(...): a falha vira "não li", nunca erro da rota nem "não tem".
  assert.equal((s.match(/exigir: true/g) ?? []).length, (s.match(/contexto\("[A-Za-z]+", \(\) => [A-Za-z]+\(\{ exigir: true \}\)/g) ?? []).length);
});

test("as leituras do contexto: com `exigir`, sessão por confirmar e erro do banco LANÇAM", () => {
  const menu = semComentarios(ler("src/lib/data/menu-actions.ts"));
  const tem = menu.slice(menu.indexOf("export async function temImovelAnunciado("), menu.indexOf("export async function imoveisAtivosDoDono("));
  assert.match(tem, /usuarioDaLeitura\(supabase, opcoes\)/);
  assert.match(tem, /if \(error && opcoes\.exigir\) throw new Error\(/);
  const ativos = menu.slice(menu.indexOf("export async function imoveisAtivosDoDono("));
  assert.match(ativos, /usuarioDaLeitura\(supabase, opcoes\)/);
  const parc = semComentarios(ler("src/lib/parceiros/painel-actions.ts"));
  const papel = parc.slice(parc.indexOf("export async function temPapelParceiro("), parc.indexOf("export async function ehParceiroAprovado("));
  assert.match(papel, /usuarioDaLeitura\(supabase, opcoes\)/);
  assert.match(papel, /if \(\(p\.error \|\| s\.error\) && opcoes\.exigir\) throw new Error\(/);
  const loc = semComentarios(ler("src/lib/data/contratos-actions.ts"));
  const minhas = loc.slice(loc.indexOf("export async function getMinhasLocacoes("), loc.indexOf("export async function getMinhasLocacoes(") + 700);
  assert.match(minhas, /usuarioDaLeitura\(supabase, opcoes\)/);
});

test("rota e casca: falha do servidor responde 503; a casca mantém o que sabia e relê quando há campo não lido", () => {
  const rota = semComentarios(ler("src/app/api/painel/contadores/route.ts"));
  assert.match(rota, /status: 503/);
  const casca = semComentarios(ler("src/components/layout/dashboard-shell.tsx"));
  assert.match(casca, /setContadores\(\(antes\) => normalizarContadores\(json, antes\)\);/);
  assert.match(casca, /if \(camposNaoLidos\(json\)\.length\) falhou\(\);\s*else falhasContadores\.current = 0;/);
});
