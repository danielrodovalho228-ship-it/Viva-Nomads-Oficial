/*
  Atendimento autônomo — regras puras e ligações.
  Roda: node --test src/lib/atendimento/autonomo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { htmlAvisoEquipe, pedePessoaNoTexto, prioridadeAcima, relataErroTecnico, RODAPE_AUTOMATICO, semDadosPessoais, textoOrdemErro, urlDoErro } from "./autonomo.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("pediu pessoa: frases do chat e só a palavra (o rodapé pede 'pessoa')", () => {
  for (const t of ["pessoa", "Pessoa.", "humano", "uma pessoa!", "quero falar com um atendente", "prefiro uma pessoa"]) assert.ok(pedePessoaNoTexto(t), t);
  for (const t of ["a pessoa que mora comigo também assina?", "como funciona a Caução?", "pessoas por imóvel"]) assert.ok(!pedePessoaNoTexto(t), t);
  assert.match(RODAPE_AUTOMATICO, /Resposta automática da Viva\. Quer falar com uma pessoa\? Responda "pessoa"\./);
});

test("pediu pessoa: prioridade sobe um nível até P2 (P1 só para urgência real)", () => {
  assert.equal(prioridadeAcima("p4"), "p3");
  assert.equal(prioridadeAcima("p3"), "p2");
  assert.equal(prioridadeAcima("p2"), "p2");
  assert.equal(prioridadeAcima("p1"), "p1");
});

test("erro técnico: página/botão/cadastro com erro; dúvida e manutenção do imóvel não", () => {
  for (const t of [
    "A página /dashboard/imoveis/novo deu erro ao salvar",
    "o botão de enviar não funciona",
    "Erro ao cadastrar meu imóvel",
    "o site ficou em branco",
    "deu erro 500 quando cliquei",
    "Página não encontrada quando abro o link",
  ])
    assert.ok(relataErroTecnico(t), t);
  for (const t of ["Como funciona a Caução?", "o chuveiro não funciona", "a geladeira travou", "quero falar com uma pessoa"]) assert.ok(!relataErroTecnico(t), t);
});

test("URL do erro: link completo ou caminho do site; pontuação final some", () => {
  assert.equal(urlDoErro("Abri https://vivanomads.com.br/anunciar. e deu erro"), "https://vivanomads.com.br/anunciar");
  assert.equal(urlDoErro("A página /dashboard/imoveis/novo deu erro"), "/dashboard/imoveis/novo");
  assert.equal(urlDoErro("o botão não funciona"), null);
});

test("ordem para Renato e Otávio: código do chamado, URL, sem contato nem documento", () => {
  const msg = "Erro ao cadastrar em /dashboard/imoveis/novo. Meu CPF 123.456.789-09, me chama no 34 99999-1234 ou ana@exemplo.com";
  const r = textoOrdemErro({ numero: "VN-000321", url: urlDoErro(msg), mensagem: msg, para: "renato" });
  const o = textoOrdemErro({ numero: "VN-000321", url: urlDoErro(msg), mensagem: msg, para: "otavio" });
  for (const t of [r, o]) {
    assert.match(t, /VN-000321/);
    assert.match(t, /\/dashboard\/imoveis\/novo/);
    assert.doesNotMatch(t, /123\.456\.789-09|99999-1234|ana@exemplo\.com/);
  }
  assert.match(r, /Reproduza, corrija e abra o PR/);
  assert.match(o, /encaminhado ao Renato/);
  assert.doesNotMatch(semDadosPessoais("CPF 12345678909"), /12345678909/);
});

test("e-mail ao Daniel: resumo, ações, sugestão e botão 'Aprovar e enviar'; texto do cliente escapado", () => {
  const html = htmlAvisoEquipe({
    numero: "VN-000321",
    assunto: "Caução <b>urgente</b>",
    motivo: "novo chamado · Contrato ou caução",
    linkAdmin: "https://vivanomads.com.br/admin/atendimento/abc",
    resumo: { resumo: "Pessoa quer saber da Caução.", acoes: [{ texto: "Explicar a Caução", para: null }], origem: "regras", geradoEm: "" },
    sugestao: "Olá! O Caução fica em poupança.",
  });
  for (const t of ["VN-000321", "Resumo", "Pessoa quer saber da Caução.", "O que fazer", "Explicar a Caução", "Resposta sugerida pela Viva", "O Caução fica em poupança", "Aprovar e enviar no admin", 'href="https://vivanomads.com.br/admin/atendimento/abc"'])
    assert.ok(html.includes(t), t);
  assert.ok(!html.includes("<b>urgente</b>"));
  const ja = htmlAvisoEquipe({ numero: "VN-1", assunto: "x", motivo: "m", linkAdmin: "https://x/admin", sugestao: "Resposta.", respondidaPelaViva: true });
  assert.ok(ja.includes("A Viva já respondeu (informação oficial)") && ja.includes("Abrir no admin") && !ja.includes("Aprovar e enviar"));
});

test("ligações: pediu pessoa nunca recebe IA; nova mensagem passa pela Viva; e-mail ao Daniel sai com a sugestão", () => {
  const serv = ler("lib/atendimento/viva-servidor.ts");
  assert.match(serv, /const motivo = pediuPessoa \? "pediu para falar com uma pessoa" : erroTecnico \? "erro técnico \(encaminhado ao Renato\)" : motivoParaAprovacao\(/);
  assert.match(serv, /`\$\{texto!\.slice\(0, 4800\)\}\\n\\n\$\{RODAPE_AUTOMATICO\}`/);
  assert.match(serv, /htmlAvisoEquipe\(\{ numero: c\.numero_publico/);
  assert.match(serv, /if \(relataErroTecnico\(lista\[ultimaPessoa\]\.corpo\)\) await encaminharErroTecnico/);
  assert.match(serv, /\[\["renato", "P1"\], \["otavio", "P2"\]\]/);
  assert.match(serv, /const prioridade = ator === "usuario" \? prioridadeAcima\(c\.prioridade\) : c\.prioridade;/);
  const acoes = ler("lib/data/atendimento-actions.ts");
  assert.match(acoes, /if \(input\.pedePessoa && !emergencia\) prioridade = prioridadeAcima\(prioridade\);/);
  assert.match(acoes, /acao: "pediu_humano"/);
  assert.match(acoes, /if \(atende !== "equipe_com_acolhimento"\) \{\s*await avisarEquipe/);
  // A promessa pública NÃO muda (decisão do Daniel, 07/10): uma pessoa em até 24 h.
  assert.match(ler("config/atendimento.ts"), /PROMESSA_ATENDIMENTO = "Assistente Viva 24 h · resposta de uma pessoa em até 24 h"/);
});
