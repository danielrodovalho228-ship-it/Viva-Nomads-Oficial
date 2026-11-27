/*
  E1188 (ORDEM-DUET-852; linha Parceiros). Os e-mails da avaliação dizem os mesmos fatos que a tela, lidos das mesmas
  funções e constantes — nunca uma cópia do texto nem um número escrito à mão:
   (i)   "Proposta de avaliação recebida": o valor e o prazo do laudo que o avaliador propôs (E1156) e o prazo do aceite
         na forma completa do E1154;
   (ii)  o aceite diz o prazo do laudo; o agendamento e o reagendamento dizem a data do laudo, pela função da tela;
   (iii) "Laudo emitido": o número VIS, o resultado, quantos itens corrigir (com a reverificação incluída, no prazo da
         regra) ou "Nada a corrigir.", e o link da página pública de conferência. Sai a frase vaga.
  O pedido de exemplo: R$ 250, 2 dias úteis, visita numa quinta (30/04/2026) com o feriado de 1.º de maio no meio.
  Cada caso monta o e-mail e o que a TELA mostra do mesmo pedido, e confere que o fato é o mesmo nos dois.
  A tela e o e-mail leem a mesma função (prazoLaudo), por isso dão a mesma data.
  E1192 (ORDEM-DUET-861: "a trava dele mede a igualdade e-mail ≡ tela, e muda junto depois"): os dias úteis passaram a
  pular os feriados nacionais. Mudaram aqui, por essa decisão: a data âncora do caso 3 (04/05/2026 → 05/05/2026, porque
  o 1.º de maio deixou de contar) e o fim do corpo dos e-mails que citam dias úteis (casos 1, 2 e 3), que ganharam a
  nota das telas — "Dias úteis: segunda a sexta, sem feriados nacionais.".
  Roda: node --test src/lib/vistoria/e1188-emails-com-os-fatos-da-tela.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { corpoVistoria, type FatosVistoria } from "./corpo-email.ts";
import { TEMPLATES } from "../notifications/eventos-email.ts";
import { comMarca, problemasDoAssunto } from "../notifications/assuntos.ts";
import { NOTA_DIAS_UTEIS } from "../calendario/dias-uteis.ts";
import { brl } from "../fiscal/documento.ts";
import { numeroExibido, urlConferir } from "../fiscal/prefixos.ts";
import { dataBRT } from "../datas-brasilia.ts";
import { PRAZO_RESSALVA_DIAS, ROTULO_RESULTADO, prazoLaudo } from "./laudo.ts";
import { linhaNivelSustentado } from "./nivel-do-laudo.ts";
import { linhaDoPrazoDoLaudo, prazoCombinadoNaLinhaDoDono } from "./pedido-avaliador.ts";
import { diasUteis } from "./prazos.ts";
import { REGRA_DO_REAGENDAMENTO } from "./regras.ts";
import { relogioDoPedido, textoDoPrazoDeAceiteParaODono } from "./relogio-do-pedido.ts";
import { itensACorrigir, prazoDoLaudo } from "./telas-laudo.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";
import { semLinksComToken } from "../notifications/caixa-teste.ts";

const RAIZ = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

const IMOVEL = { titulo: "Apto Santa Mônica", bairro: "Santa Mônica", cidade: "Uberlândia" };
/** O pedido de exemplo, como a tabela o guarda (é daqui que a TELA lê). */
const PEDIDO = {
  valor_tabela: 300,
  valor_proposto: 250,
  prazo_proposto_dias: 2,
  prazo_laudo_dias_uteis: 2,
  teste: false,
  escolhido_em: "2026-04-27T12:00:00Z",
  // Terça, 28/04/2026, 09:15 em Brasília.
  proposta_em: "2026-04-28T12:15:00Z",
  // Quinta, 30/04/2026, 10:00 em Brasília. A sexta, 01/05, é feriado.
  agendado_para: "2026-04-30T13:00:00Z",
};
/** A visita remarcada: terça, 05/05/2026, 14:30 em Brasília. */
const NOVA_VISITA = "2026-05-05T17:30:00Z";
/** O laudo de exemplo, como a tabela o guarda. */
const LAUDO = {
  numero: "VIS-2026-000012",
  versao: 1,
  resultado: "com_ressalvas" as const,
  nivel_sustentado: "conforto",
  ressalvas: [
    { chave: "chuveiro_quente", reverificacao: "foto" as const },
    { chave: "fechadura_porta", reverificacao: "visita" as const },
  ],
  graves: [] as string[],
  codigo_verificacao: "9f2c4e7a1b3d",
};
const SITE = "https://vivanomads.com.br";

/** Os fatos que o servidor entrega ao e-mail, a partir das mesmas colunas. */
const DO_PEDIDO: FatosVistoria = {
  imovel: IMOVEL,
  avaliador: "Rui Avalia",
  numeroCredenciado: "AV-0007",
  propostaEm: PEDIDO.proposta_em,
  valorProposto: PEDIDO.valor_proposto,
  prazoPropostoDias: PEDIDO.prazo_proposto_dias,
  prazoLaudoDiasUteis: PEDIDO.prazo_laudo_dias_uteis,
};
const DO_LAUDO: FatosVistoria = {
  ...DO_PEDIDO,
  laudo: {
    numero: LAUDO.numero,
    versao: LAUDO.versao,
    resultado: LAUDO.resultado,
    nivelSustentado: LAUDO.nivel_sustentado,
    itensACorrigir: itensACorrigir(LAUDO).length,
    linkConferir: urlConferir(SITE, LAUDO.codigo_verificacao),
  },
};

test("E1188 (1): a proposta chegou — o e-mail diz o valor, o prazo do laudo e a data do aceite que a tela do dono mostra", () => {
  const c = corpoVistoria("vistoria_designado_dono", DO_PEDIDO);
  // A TELA do dono (bloco da avaliação): "Proposta do avaliador: R$ 250,00 · laudo em até 2 dias úteis depois da visita".
  const naTela = `${brl(Number(PEDIDO.valor_proposto))} · ${prazoCombinadoNaLinhaDoDono(PEDIDO, null)}`;
  assert.equal(naTela, "R$ 250,00 · laudo em até 2 dias úteis depois da visita");
  // E o prazo do aceite, pelo relógio do pedido (E1154), como o dono o lê enquanto a proposta espera por ele.
  const relogio = relogioDoPedido({ status: "designado", resposta: undefined, designadoEm: null, propostaEm: PEDIDO.proposta_em, propostaAceitaEm: null, precisaDoAceite: true }, new Date(PEDIDO.proposta_em));
  const aceite = textoDoPrazoDeAceiteParaODono(relogio);
  assert.equal(aceite, "Aceite em até 72 horas depois da proposta, até 01/05/2026 09:15 (horário de Brasília); passado o prazo, você escolhe outro avaliador.");
  assert.equal(c.body("Lara"), `Olá Lara, Rui Avalia enviou a proposta para a avaliação de Apto Santa Mônica: ${naTela}. ${aceite} ${NOTA_DIAS_UTEIS}`);
  assert.equal(c.subject, "Proposta de avaliação recebida: Apto Santa Mônica");
  // O pedido anterior à regra dos dias úteis mantém a promessa que recebeu, como a tela a escreve.
  const antigo = { ...PEDIDO, prazo_proposto_dias: 7, prazo_laudo_dias_uteis: null };
  const cAntigo = corpoVistoria("vistoria_designado_dono", { ...DO_PEDIDO, prazoPropostoDias: 7, prazoLaudoDiasUteis: null });
  assert.ok(cAntigo.body("Lara").includes(`: ${brl(250)} · ${prazoCombinadoNaLinhaDoDono(antigo, null)}. `), cAntigo.body("Lara"));
  assert.equal(prazoCombinadoNaLinhaDoDono(antigo, null), "laudo em 7 dias");
  // E1192: sem "dias úteis" no corpo, sem nota — o pedido anterior à regra não a leva.
  assert.ok(!cAntigo.body("Lara").includes(NOTA_DIAS_UTEIS), cAntigo.body("Lara"));
  // Sem o valor (a leitura falhou, ou o modelo sem os fatos): a frase de antes, inteira — nunca "R$ NaN" nem "undefined".
  const sem = corpoVistoria("vistoria_designado_dono", { imovel: IMOVEL, avaliador: "Rui Avalia", propostaEm: PEDIDO.proposta_em });
  assert.equal(sem.body("Lara"), `Olá Lara, Rui Avalia, avaliador credenciado que você escolheu, enviou a proposta de valor e prazo para a avaliação de Apto Santa Mônica. ${aceite}`);
  assert.doesNotMatch(TEMPLATES.vistoria_designado_dono.body("Lara"), /R\$|NaN|undefined|null/);
});

test("E1188 (2): o aceite diz o prazo do laudo, pela frase da tela do avaliador", () => {
  const c = corpoVistoria("vistoria_proposta_aceita", DO_PEDIDO);
  // A TELA do avaliador, depois do aceite: "Laudo em até 2 dias úteis depois da visita".
  const naTela = linhaDoPrazoDoLaudo("aceito", PEDIDO);
  assert.equal(naTela, "Laudo em até 2 dias úteis depois da visita");
  assert.equal(c.body("Rui"), `Olá Rui, o proprietário aceitou a sua proposta de avaliação de Apto Santa Mônica. Combinem a data da visita. ${naTela}. ${NOTA_DIAS_UTEIS}`);
  // Sem o prazo (o modelo sem os fatos), o e-mail de antes — sem frase pela metade.
  assert.equal(corpoVistoria("vistoria_proposta_aceita", { imovel: IMOVEL }).body("Rui"), "Olá Rui, o proprietário aceitou a sua proposta de avaliação de Apto Santa Mônica. Combinem a data da visita.");
});

test("E1188 (3): o agendamento diz a data do laudo — a mesma da tela do dono e da tela do avaliador", () => {
  const c = corpoVistoria("vistoria_agendada", { ...DO_PEDIDO, visita: PEDIDO.agendado_para });
  // A TELA do dono: "Combinado com o avaliador: R$ 250,00 · Laudo até 05/05/2026."
  const naTelaDoDono = prazoCombinadoNaLinhaDoDono(PEDIDO, PEDIDO.agendado_para);
  // A TELA do avaliador: "Envie até 05/05/2026 às 10:00, horário de Brasília (2 dias úteis depois da visita)."
  const naTelaDoAvaliador = prazoDoLaudo(PEDIDO.agendado_para, new Date(PEDIDO.agendado_para), PEDIDO.prazo_laudo_dias_uteis).texto;
  const data = dataBRT(prazoLaudo(PEDIDO.agendado_para, PEDIDO.prazo_laudo_dias_uteis));
  assert.equal(naTelaDoDono, `Laudo até ${data}`);
  assert.ok(naTelaDoAvaliador.startsWith(`Envie até ${data} às 10:00`), naTelaDoAvaliador);
  const laudo = `${naTelaDoDono} (${diasUteis(PEDIDO.prazo_laudo_dias_uteis)} depois da visita)`;
  assert.equal(c.body("Lara"), `Olá Lara, a visita de avaliação de Apto Santa Mônica está agendada para 30/04/2026 às 10:00 (horário de Brasília). ${laudo}. ${REGRA_DO_REAGENDAMENTO} ${NOTA_DIAS_UTEIS}`);
  assert.deepEqual(c.linhas, [
    { rotulo: "Imóvel", valor: "Apto Santa Mônica · Santa Mônica, Uberlândia" },
    { rotulo: "Visita", valor: "30/04/2026 às 10:00 (horário de Brasília)" },
    { rotulo: "Laudo", valor: `até ${data} (${diasUteis(PEDIDO.prazo_laudo_dias_uteis)} depois da visita)` },
  ]);
  // A âncora do exemplo (E1192): quinta 30/04 + 2 dias úteis. A sexta 01/05 é feriado nacional e não conta; sábado e
  // domingo também não. Segunda 04/05 é o 1.º dia útil, terça 05/05 o 2.º — na tela e no e-mail, pela mesma função.
  assert.equal(data, "05/05/2026");
  // O reagendamento traz a nova data do laudo (e continua a dizer que a data mudou, e qual era).
  const r = corpoVistoria("vistoria_agendada", { ...DO_PEDIDO, visita: NOVA_VISITA, reagendada: true, visitaAnterior: PEDIDO.agendado_para });
  const novaData = dataBRT(prazoLaudo(NOVA_VISITA, PEDIDO.prazo_laudo_dias_uteis));
  assert.equal(prazoCombinadoNaLinhaDoDono(PEDIDO, NOVA_VISITA), `Laudo até ${novaData}`);
  assert.equal(novaData, "07/05/2026");
  assert.equal(r.body("Lara"), `Olá Lara, a visita de avaliação de Apto Santa Mônica tem nova data: 05/05/2026 às 14:30; antes: 30/04/2026 às 10:00 (horário de Brasília). Laudo até ${novaData} (2 dias úteis depois da visita). ${REGRA_DO_REAGENDAMENTO} ${NOTA_DIAS_UTEIS}`);
  assert.deepEqual(r.linhas.at(-1), { rotulo: "Laudo", valor: `até ${novaData} (2 dias úteis depois da visita)` });
  // O pedido anterior à regra não tem data de laudo a prometer: o e-mail repete a promessa antiga, sem inventar data.
  const antigo = corpoVistoria("vistoria_agendada", { ...DO_PEDIDO, prazoPropostoDias: 7, prazoLaudoDiasUteis: null, visita: PEDIDO.agendado_para });
  assert.ok(antigo.body("Lara").includes("(horário de Brasília). Laudo em 7 dias. Reagendar"), antigo.body("Lara"));
  assert.equal(antigo.linhas.some((l) => l.rotulo === "Laudo"), false);
  // Sem prazo nenhum (o modelo sem os fatos; a avaliação de teste do credenciamento): o e-mail de antes.
  assert.equal(corpoVistoria("vistoria_agendada", { imovel: IMOVEL, visita: PEDIDO.agendado_para }).body("Lara"), `Olá Lara, a visita de avaliação de Apto Santa Mônica está agendada para 30/04/2026 às 10:00 (horário de Brasília). ${REGRA_DO_REAGENDAMENTO}`);
  // Só o agendamento leva a data do laudo: o pedido de concordância do morador e o lembrete não mudam.
  for (const ev of ["vistoria_concordancia", "vistoria_lembrete", "vistoria_ausencia"] as const) {
    const o = corpoVistoria(ev, { ...DO_PEDIDO, visita: PEDIDO.agendado_para });
    assert.doesNotMatch(o.body("Lara"), /Laudo até/, ev);
    assert.equal(o.linhas.some((l) => l.rotulo === "Laudo"), false, ev);
  }
});

test("E1188 (4): o laudo emitido diz o número VIS, o resultado, o que corrigir e onde conferir — como a tela do dono", () => {
  const c = corpoVistoria("vistoria_laudo_emitido", DO_LAUDO);
  // A TELA do dono: "Laudo VIS-2026-000012 · Com ressalvas · nível sustentado: …", a lista "O que corrigir" e "Conferir o laudo".
  const numero = numeroExibido(LAUDO.numero, LAUDO.versao);
  const resultado = ROTULO_RESULTADO[LAUDO.resultado];
  const nivel = linhaNivelSustentado(LAUDO.nivel_sustentado);
  const n = itensACorrigir(LAUDO).length;
  const link = urlConferir(SITE, LAUDO.codigo_verificacao);
  assert.equal(numero, "VIS-2026-000012");
  assert.equal(resultado, "Com ressalvas");
  assert.equal(nivel, "Nível sustentado: Conforto");
  assert.equal(n, 2);
  // A forma direta dos recibos: a mesma página que a tela abre por "/conferir?codigo=…" (esse caminho redireciona para cá).
  assert.equal(link, "https://vivanomads.com.br/conferir/9f2c4e7a1b3d");
  assert.equal(
    c.body("Lara"),
    `Olá Lara, o laudo de avaliação de Apto Santa Mônica foi emitido e assinado pelo avaliador credenciado nº AV-0007; a Viva guarda o registro. Laudo ${numero}. Resultado: ${resultado}. ${nivel}. O que corrigir: ${n} itens. A reverificação desses itens está incluída, pelo mesmo avaliador, em até ${PRAZO_RESSALVA_DIAS} dias. Para conferir: ${link}`,
  );
  // O prazo da reverificação é o da regra (o mesmo número do aviso da ressalva vencida), não um número do e-mail.
  assert.equal(PRAZO_RESSALVA_DIAS, 15);
  assert.ok(corpoVistoria("vistoria_ressalva_vencida", { imovel: IMOVEL }).body("Lara").includes(`o prazo de ${PRAZO_RESSALVA_DIAS} dias`));
  // Um item só: singular.
  const um = corpoVistoria("vistoria_laudo_emitido", { ...DO_LAUDO, laudo: { ...DO_LAUDO.laudo!, itensACorrigir: 1 } });
  assert.ok(um.body("Lara").includes("O que corrigir: 1 item. A reverificação desse item está incluída, pelo mesmo avaliador, em até 15 dias. "), um.body("Lara"));
  // Aprovado: nada a corrigir.
  const ok = corpoVistoria("vistoria_laudo_emitido", { ...DO_LAUDO, laudo: { ...DO_LAUDO.laudo!, resultado: "aprovado", itensACorrigir: 0 } });
  assert.ok(ok.body("Lara").includes(`Laudo ${numero}. Resultado: Aprovado. Nível sustentado: Conforto. Nada a corrigir. Para conferir: ${link}`), ok.body("Lara"));
  // Reprovado: não há reverificação incluída (a regra só a dá às ressalvas) — o e-mail não a promete.
  const rep = corpoVistoria("vistoria_laudo_emitido", { ...DO_LAUDO, laudo: { ...DO_LAUDO.laudo!, resultado: "reprovado", itensACorrigir: 1 } });
  assert.ok(rep.body("Lara").includes(`Resultado: Reprovado. Nível sustentado: Conforto. Para conferir: ${link}`), rep.body("Lara"));
  assert.doesNotMatch(rep.body("Lara"), /reverificação|Nada a corrigir|O que corrigir/);
  // Uma nova versão do laudo (reverificação, contestação) diz a versão, como a tela.
  const v2 = corpoVistoria("vistoria_laudo_emitido", { ...DO_LAUDO, laudo: { ...DO_LAUDO.laudo!, versao: 2 } });
  assert.ok(v2.body("Lara").includes(`Laudo ${numeroExibido(LAUDO.numero, 2)}. `), v2.body("Lara"));
  assert.equal(numeroExibido(LAUDO.numero, 2), "VIS-2026-000012 v2");
  // Sem o código de conferência, a frase do link não aparece pela metade.
  const semLink = corpoVistoria("vistoria_laudo_emitido", { ...DO_LAUDO, laudo: { ...DO_LAUDO.laudo!, linkConferir: null } });
  assert.ok(semLink.body("Lara").endsWith("em até 15 dias."), semLink.body("Lara"));
  // A frase vaga saiu: com os fatos, sem os fatos e no modelo.
  const sem = corpoVistoria("vistoria_laudo_emitido", { imovel: IMOVEL, numeroCredenciado: "AV-0007" });
  assert.equal(sem.body("Lara"), "Olá Lara, o laudo de avaliação de Apto Santa Mônica foi emitido e assinado pelo avaliador credenciado nº AV-0007; a Viva guarda o registro.");
  for (const corpo of [c.body("Lara"), sem.body("Lara"), TEMPLATES.vistoria_laudo_emitido.body("Lara")]) {
    assert.doesNotMatch(corpo, /Veja o resultado|se houver|undefined|null|NaN/);
  }
  // O assunto segue a régua dos assuntos (o número do documento fica no corpo).
  assert.deepEqual(problemasDoAssunto(comMarca(c.subject!)), []);
});

test("E1188 (5): a tela e o e-mail leem as mesmas funções — a contagem do que corrigir e o número do laudo; o link leva à mesma página", () => {
  // A contagem: ressalvas e itens graves, sem repetir (um item grave que também é ressalva conta uma vez).
  assert.deepEqual(itensACorrigir({ ressalvas: [{ chave: "a" }, { chave: "b" }], graves: ["b", "c"] }), ["a", "b", "c"]);
  assert.deepEqual(itensACorrigir({ ressalvas: [], graves: [] }), []);
  assert.equal(urlConferir("https://vivanomads.com.br/", "AB C/1"), "https://vivanomads.com.br/conferir/AB%20C%2F1");
  // O link do e-mail é o direto e não leva parâmetro: a caixa de e-mails das contas de teste esconde links com
  // parâmetro de código ("[link com token removido]"), e o link do laudo tem de se poder ler lá.
  assert.equal(semLinksComToken(`Para conferir: ${urlConferir(SITE, LAUDO.codigo_verificacao)}`), `Para conferir: ${urlConferir(SITE, LAUDO.codigo_verificacao)}`);
  assert.equal(semLinksComToken(`Para conferir: ${SITE}/conferir?codigo=${LAUDO.codigo_verificacao}`), "Para conferir: [link com token removido]");
  // A entrada "/conferir?codigo=…" (o link da tela) redireciona para a página direta do mesmo código.
  const entrada = semComentarios(ler("src/app/(public)/conferir/page.tsx"));
  assert.match(entrada, /redirect\(`\/conferir\/\$\{digitado\}`\)/);
  const telaDoDono = semComentarios(ler("src/components/vistoria/laudo-dono.tsx"));
  assert.match(telaDoDono, /const itensCorrigir = l \? itensACorrigir\(l\) : \[\];/);
  assert.match(telaDoDono, /href=\{`\/conferir\?codigo=\$\{encodeURIComponent\(String\(doc\.codigo_verificacao\)\)\}`\}/);
  assert.match(telaDoDono, /Laudo \{numeroExibido\(l\.numero, l\.versao\)\}/);
  assert.doesNotMatch(telaDoDono, /new Set\(\[\.\.\.l\.ressalvas/);
  // A frase do prazo do laudo depois do aceite sai de uma função só: a linha da tela do avaliador e o e-mail.
  const pedido = semComentarios(ler("src/lib/vistoria/pedido-avaliador.ts"));
  assert.equal((pedido.match(/`Laudo em até \$\{diasUteis\(/g) ?? []).length, 1);
});

test("E1188 (6): o servidor entrega ao e-mail as colunas que a tela lê", () => {
  const srv = semComentarios(ler("src/lib/vistoria/servidor.ts"));
  const fatos = srv.slice(srv.indexOf("export async function fatosDaVistoria"), srv.indexOf("export async function avisar"));
  // O pedido: o valor e os dois prazos (o novo, em dias úteis, e o de antes).
  for (const coluna of ["valor_proposto", "prazo_proposto_dias", "prazo_laudo_dias_uteis"]) assert.match(fatos, new RegExp(`\\.select\\("[^"]*\\b${coluna}\\b`), coluna);
  assert.match(fatos, /valorProposto: /);
  assert.match(fatos, /prazoLaudoDiasUteis: /);
  // O laudo: o último do pedido, com o que a tela do dono mostra, e o código do documento registrado.
  assert.match(fatos, /\.from\("vistoria_laudos"\)\s*\.select\("numero, versao, resultado, nivel_sustentado, ressalvas, graves, documento_id"\)/);
  assert.match(fatos, /\.from\("documentos_registro"\)\.select\("codigo_verificacao"\)/);
  assert.match(fatos, /itensACorrigir: itensACorrigir\(/);
  assert.match(fatos, /linkConferir: codigo \? urlConferir\(SITE_URL, codigo\) : null/);
  // Só o aviso do laudo emitido lê o laudo (os outros não precisam dele).
  const avisar = srv.slice(srv.indexOf("export async function avisar"), srv.indexOf("export async function resolverAvisosDaVisita"));
  assert.match(avisar, /fatosDaVistoria\(admin, ref, \{ comLaudo: ev === "vistoria_laudo_emitido" \}\)/);
});

test("E1188 (7): nenhum prazo nem valor do e-mail é escrito à mão", () => {
  const email = semComentarios(ler("src/lib/vistoria/corpo-email.ts"));
  // Um número seguido da unidade ("72 horas", "15 dias", "2 dias úteis", "12 meses") ou um valor em reais.
  const ESCRITO_A_MAO = /\b\d+\s+(?:horas?|h\b|dias?|meses|m[êe]s)\b|R\$\s?\d/;
  const achados = email.split("\n").map((l, i) => ({ l: l.trim(), n: i + 1 })).filter(({ l }) => ESCRITO_A_MAO.test(l));
  assert.deepEqual(achados, [], "prazo ou valor escrito à mão no e-mail da avaliação");
  // E as fontes de onde saem: o relógio do aceite, a linha do prazo do laudo e a regra da ressalva.
  assert.match(email, /import \{[^}]*\btextoDoPrazoDeAceiteDesdeAProposta\b[^}]*\} from "\.\/relogio-do-pedido\.ts";/);
  assert.match(email, /import \{[^}]*\bprazoCombinadoNaLinhaDoDono\b[^}]*\} from "\.\/pedido-avaliador\.ts";/);
  assert.match(email, /import \{[^}]*\bPRAZO_RESSALVA_DIAS\b[^}]*\} from "\.\/laudo\.ts";/);
  assert.match(email, /import \{ brl \} from "\.\.\/fiscal\/documento\.ts";/);
  // A regra detecta o que quer detectar.
  for (const mau of ["aceite em 72 horas", "em até 15 dias", "laudo em 2 dias úteis", "R$ 250"]) assert.match(mau, ESCRITO_A_MAO, mau);
  for (const bom of ["`em até ${PRAZO_RESSALVA_DIAS} dias`", "a 2ª avaliação", "05/11/2026 às 10:00"]) assert.doesNotMatch(bom, ESCRITO_A_MAO, bom);
});
