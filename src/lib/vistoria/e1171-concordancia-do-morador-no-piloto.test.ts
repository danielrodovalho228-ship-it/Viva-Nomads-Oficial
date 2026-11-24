import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chaveAberta, chaveAbertaParaOMorador, modoDaChave } from "./ambito-da-chave.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1171 (ORDEM-DUET-746; BLOQUEADOR da linha Parceiros). No imóvel ocupado a visita de avaliação só acontece com a
  concordância do morador. A superfície dele existe (a página /dashboard/avaliacao-imovel/[id], o cartão na conversa da
  estadia e a ação "Concordo"), mas as três perguntavam se a avaliação estava ligada para a conta DA SESSÃO. No piloto
  (E1077) quem está na lista é o dono e o avaliador; o morador não. Para ele a página dava "não encontrada", o cartão
  não aparecia e a ação respondia "ainda não está disponível" — e a visita ficava para sempre à espera dele.
  A regra certa: a concordância pertence ao PEDIDO. Para o morador, a chave vale pela sessão OU pelo dono do pedido
  estar no piloto. Com a chave desligada para todos, continua fechada.
  Roda: node --test src/lib/vistoria/e1171-concordancia-do-morador-no-piloto.test.ts
*/
const ler = (p: string) => semComentarios(readFileSync(p, "utf8"));

test("E1171 — a regra: para o morador, a chave vale pela sessão ou pelo dono do pedido no piloto", () => {
  // O caso do piloto: a conta do morador está fora da lista (a sessão dele lê "desligada"), o dono está dentro.
  const sessaoDoMorador = modoDaChave({ global: false, laboratorio: false, noPiloto: false });
  assert.equal(sessaoDoMorador, "desligada");
  assert.equal(chaveAberta(sessaoDoMorador), false, "a porta de antes: fechada para o morador do piloto");
  assert.equal(chaveAbertaParaOMorador(sessaoDoMorador, true), true, "o dono do pedido no piloto abre a concordância");
  // Desligada para todos: o dono fora do piloto não abre nada.
  assert.equal(chaveAbertaParaOMorador("desligada", false), false);
  // A sessão já aberta (lançamento, laboratório, ou o próprio morador no piloto) continua a valer, com ou sem o dono.
  for (const modo of ["global", "laboratorio", "piloto"] as const) {
    assert.equal(chaveAbertaParaOMorador(modo, false), true, modo);
    assert.equal(chaveAbertaParaOMorador(modo, true), true, modo);
  }
});

test("E1171: o servidor lê o piloto pelo DONO do pedido — e a leitura que falha fecha, nunca abre", () => {
  const chave = ler("src/lib/vistoria/chave.ts");
  const fn = chave.slice(chave.indexOf("export async function vistoriaAtivaParaOMorador("));
  assert.match(fn, /export async function vistoriaAtivaParaOMorador\(admin: Admin, donoDoPedido: string \| null \| undefined\): Promise<boolean> \{/);
  assert.match(fn, /const modo = await modoDaChaveAtual\(\);/);
  assert.match(fn, /if \(chaveAberta\(modo\)\) return true;/);
  assert.match(fn, /if \(!donoDoPedido\) return false;/);
  assert.match(fn, /from\("vistoria_piloto"\)\.select\("user_id"\)\.eq\("user_id", donoDoPedido\)\.maybeSingle\(\)/);
  assert.match(fn, /return chaveAbertaParaOMorador\(modo, !error && !!data\);/);
});

test("E1171: a página do morador pede o login primeiro, confere que o pedido é dele e só então a chave — pelo pedido", () => {
  const pagina = ler("src/app/(dashboard)/dashboard/avaliacao-imovel/[id]/page.tsx");
  assert.doesNotMatch(pagina, /await vistoriaAtiva\(\)/, "a chave da conta do morador não fecha a página dele");
  const login = pagina.indexOf("if (!user) redirect(");
  const dele = pagina.indexOf("if (!p || p.morador_id !== user.id || !p.ocupado) notFound();");
  const chave = pagina.indexOf("if (!(await vistoriaAtivaParaOMorador(admin, p.owner_id))) notFound();");
  assert.ok(login > 0 && dele > login && chave > dele, "login → o pedido é dele → a chave pelo dono do pedido");
  assert.match(pagina, /select\("id, owner_id, morador_id, agendado_para, concordancia_em, ocupado, status"\)/);
});

test("E1171: a ação de concordar e o cartão da conversa abrem pela mesma regra", () => {
  const acoes = ler("src/lib/vistoria/actions.ts");
  const concordar = acoes.slice(acoes.indexOf("export async function concordarVisita("), acoes.indexOf("export async function registrarAusencia("));
  assert.doesNotMatch(concordar, /await vistoriaAtiva\(\)/);
  const dele = concordar.indexOf("if (!p || p.morador_id !== s.userId || !p.ocupado || !p.agendado_para || p.status !== \"designado\") return SEM_ACESSO;");
  const chave = concordar.indexOf("if (!(await vistoriaAtivaParaOMorador(s.admin, p.owner_id))) return DESLIGADA;");
  assert.ok(dele > 0 && chave > dele, "primeiro o pedido é dele; depois a chave pelo dono do pedido");
  assert.ok(chave < concordar.indexOf(".update({ concordancia_em:"), "a chave é conferida antes de gravar");
  const conversa = ler("src/lib/vistoria/conversa-actions.ts");
  assert.doesNotMatch(conversa, /await vistoriaAtiva\(\)/);
  assert.match(conversa, /\.select\("id, owner_id, agendado_para, concordancia_em, status"\)/);
  assert.match(conversa, /if \(!data\?\.agendado_para \|\| !\(await vistoriaAtivaParaOMorador\(admin, data\.owner_id as string \| null\)\)\) return null;/);
});

test("E1171: o aviso da concordância e o lembrete levam o morador à página dele", () => {
  const acoes = ler("src/lib/vistoria/actions.ts");
  assert.match(acoes, /await avisar\(s\.admin, p\.morador_id, "vistoria_concordancia", rotaMorador\(p\.id\),/);
  const servidor = ler("src/lib/vistoria/servidor.ts");
  assert.match(servidor, /export const rotaMorador = \(pedidoId: string\) => `\/dashboard\/avaliacao-imovel\/\$\{pedidoId\}`;/);
});
