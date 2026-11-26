import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EVENTOS_VISTORIA_COM_FATOS, corpoVistoria } from "./corpo-email.ts";
import { TEMPLATES } from "../notifications/eventos-email.ts";
import { MATRIZ_NOTIFICACOES } from "../../config/matriz-notificacoes.ts";
import { TEMA_POR_EVENTO } from "../notifications/imagens-email.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1144 (ORDEM-DUET-643). Quando a proposta de avaliação vencia sem o aceite, o DONO recebia o modelo genérico
  ("Novidade na escolha do avaliador": respondeu, recusou ou não respondeu…), que não diz o que aconteceu nem o que ele
  faz a seguir — provado ao vivo duas vezes na perna 8. Passa a receber o e-mail próprio da expiração, nos textos
  aprovados (espelham o do ecrã, aprovado pelo Daniel):
   • assunto: "O prazo para aceitar a proposta de avaliação terminou: [imóvel]" — que não cabe com o imóvel na régua
     dos 70 caracteres (sobra 1); o que sai é a forma curta "A proposta de avaliação expirou: [imóvel]", irmã do
     assunto aprovado do avaliador, e sem imóvel vale a frase aprovada inteira;
   • corpo: "Olá [nome], o prazo de 72 horas para aceitar a proposta de avaliação de [imóvel] terminou, e ela expirou.
     O pedido voltou para você escolher de novo." + botão "Escolher avaliador" (a página do imóvel).
  O e-mail do avaliador (E1142) fica. Sem expiração da proposta, nenhum dos dois sai.
*/
const ler = (p: string) => readFileSync(p, "utf8");
const EVENTO = "vistoria_proposta_expirada_dono" as const;
const CASA = { imovel: { id: "i1", titulo: "Casa do Lago", bairro: "Centro", cidade: "Sacramento" } };

test("E1144: o corpo diz ao dono o que aconteceu e o que ele faz — o texto aprovado, com o imóvel", () => {
  assert.ok(EVENTOS_VISTORIA_COM_FATOS.has(EVENTO), "o e-mail leva os fatos do pedido (o imóvel)");
  const c = corpoVistoria(EVENTO, CASA);
  assert.equal(c.body("Dalva"), "Olá Dalva, o prazo de 72 horas para aceitar a proposta de avaliação de Casa do Lago terminou, e ela expirou. O pedido voltou para você escolher de novo.");
  assert.equal(c.body(), "Olá, o prazo de 72 horas para aceitar a proposta de avaliação de Casa do Lago terminou, e ela expirou. O pedido voltou para você escolher de novo.");
  // O bloco de dados é o dos outros e-mails da avaliação: a linha do imóvel, como o E1142 a manda ao avaliador.
  assert.deepEqual(c.linhas, corpoVistoria("vistoria_proposta_expirada", CASA).linhas);
  assert.equal(c.linhas.length, 1);
  assert.equal(c.linhas[0].rotulo, "Imóvel");
  assert.match(c.linhas[0].valor, /^Casa do Lago · Centro, Sacramento/);
  // Sem o título do imóvel, a frase continua inteira.
  assert.equal(corpoVistoria(EVENTO, { imovel: null }).body("Dalva"), "Olá Dalva, o prazo de 72 horas para aceitar a proposta de avaliação do seu imóvel terminou, e ela expirou. O pedido voltou para você escolher de novo.");
});

test("E1144: o assunto nomeia o imóvel, cabe na régua, não leva códigos internos; o botão é 'Escolher avaliador'", () => {
  const t = TEMPLATES[EVENTO];
  // Sem imóvel para nomear, vale a frase aprovada inteira.
  assert.equal(t.subject, "O prazo para aceitar a proposta de avaliação terminou");
  assert.equal(corpoVistoria(EVENTO, { imovel: null }).subject, null);
  assert.equal(t.cta, "Escolher avaliador");
  assert.equal(t.body("Dalva"), "Olá Dalva, o prazo de 72 horas para aceitar a proposta de avaliação do seu imóvel terminou, e ela expirou. O pedido voltou para você escolher de novo.");
  // Com imóvel: a forma aprovada é tentada primeiro; como deixa 1 carácter para o título, sai a forma curta.
  const fonte = semComentarios(ler("src/lib/vistoria/corpo-email.ts"));
  const caso = fonte.slice(fonte.indexOf(`case "${EVENTO}":`), fonte.indexOf('case "vistoria_agendada":'));
  assert.match(caso, /assuntoComTitulo\("O prazo para aceitar a proposta de avaliação terminou: ", titulo, "", \{ antes: "A proposta de avaliação expirou: " \}\)/);
  assert.equal(corpoVistoria(EVENTO, CASA).subject, "A proposta de avaliação expirou: Casa do Lago");
  const comprido = corpoVistoria(EVENTO, { imovel: { titulo: "Apartamento de 2 quartos com varanda no Centro", bairro: "Centro", cidade: "Uberlândia" } }).subject!;
  assert.match(comprido, /^A proposta de avaliação expirou: Apartamento de 2/);
  for (const assunto of [corpoVistoria(EVENTO, CASA).subject!, comprido, t.subject]) {
    assert.ok(`${assunto} · Viva Nomads`.length <= 70, `"${assunto}" cabe na régua com a marca`);
    assert.doesNotMatch(assunto, /vistoria_|VIS-\d|VN-[0-9A-F]{6}|[0-9a-f]{8}-[0-9a-f]{4}-/);
  }
});

test("E1144: é um aviso de decisão do proprietário, sem push, com o tema dos transacionais", () => {
  assert.equal(MATRIZ_NOTIFICACOES[EVENTO].categoria, "decisao");
  assert.deepEqual(MATRIZ_NOTIFICACOES[EVENTO].papeis, ["proprietario"]);
  assert.ok(!MATRIZ_NOTIFICACOES[EVENTO].canais.includes("push"));
  assert.equal(TEMA_POR_EVENTO[EVENTO], "transacional");
});

test("E1144: a rotina — a proposta vencida dispara ESTE e-mail ao dono (com o destino na página do imóvel) e mantém o do avaliador", () => {
  const srv = semComentarios(ler("src/lib/vistoria/servidor.ts"));
  const rotina = srv.slice(srv.indexOf("export async function rotinaVistoria("), srv.indexOf("export async function comTesteConcluido("));
  const ramo = rotina.slice(rotina.indexOf("const { data: propostas }"), rotina.indexOf("const { data: parados }"));
  assert.match(ramo, /avisar\(admin, q\.owner_id, "vistoria_proposta_expirada_dono", rotaDono\(q\.property_id\), \{ pedidoId: q\.id, propertyId: q\.property_id \}\)/);
  assert.doesNotMatch(ramo, /"vistoria_designado_dono"/, "o modelo genérico já não sai na expiração da proposta");
  assert.match(ramo, /avisar\(admin, q\.avaliadores_credenciamento\?\.parceiros\?\.user_id, "vistoria_proposta_expirada", ROTA_AVALIADOR/, "o e-mail do avaliador (E1142) fica");
});

test("E1144: sem expiração da proposta, nenhum dos dois sai — só o ramo da proposta vencida os envia", () => {
  const fontes = ["src/lib/vistoria/servidor.ts", "src/lib/vistoria/actions.ts", "src/lib/vistoria/laudo-servidor.ts", "src/lib/vistoria/ativacao-automatica-servidor.ts"].map((f) => semComentarios(ler(f)));
  const envios = (evento: string) => fontes.reduce((n, f) => n + (f.match(new RegExp(`avisar\\([^;]*"${evento}"`, "g")) ?? []).length, 0);
  assert.equal(envios("vistoria_proposta_expirada_dono"), 1, "um só ponto envia o e-mail do dono");
  assert.equal(envios("vistoria_proposta_expirada"), 1, "um só ponto envia o e-mail do avaliador");
  // Os dois vêm depois das duas guardas do ramo: a proposta está vencida E o pedido precisa do aceite do dono.
  const srv = fontes[0];
  const ramo = srv.slice(srv.indexOf("const { data: propostas }"), srv.indexOf("const { data: parados }"));
  const guardaVencida = ramo.indexOf("!propostaVencida(q.proposta_em, agora)) continue;");
  const guardaAceite = ramo.indexOf("if (!precisaDoAceiteDoDono(");
  const envioDono = ramo.indexOf('"vistoria_proposta_expirada_dono"');
  assert.ok(guardaVencida > 0 && guardaAceite > guardaVencida && envioDono > guardaAceite);
  // O silêncio do avaliador (o outro ramo da rotina) continua a avisar o dono — E1160 (1) (asserção alterada,
  // ORDEM-DUET-674): agora pelo evento próprio dele, e não pelo modelo genérico.
  const silencio = srv.slice(srv.indexOf("const { data: abertas }"), srv.indexOf("const { data: propostas }"));
  assert.match(silencio, /avisar\(admin, p\.owner_id, "vistoria_sem_resposta_dono"/);
  assert.doesNotMatch(silencio, /vistoria_proposta_expirada/);
});
