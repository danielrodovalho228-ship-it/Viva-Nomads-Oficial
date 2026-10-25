/*
  Prompt 35B — pacote de provas (#901: F4, i, ii, iii), conferência no pacote e admin › contrato (F5).
  Roda: node --test src/lib/provas-admin-35b.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { gerarPdf } from "./fiscal/pdf.ts";
import { textoDoPdf } from "./fiscal/pdf-texto.ts";
import { conteudoPacoteProvas, eventosDoContrato, montarDadosProvas, totaisPagamentos, type DadosProvas, type LinhasProvas } from "./contrato-provas.ts";
import { compararHashComResumo, hashConfereComResumo, hashResumo, linhasParaHash, resumoContrato } from "./contrato-assinar.ts";
import { seloParaEquipe } from "./contrato-estado.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const plano = (s: string) => s.replace(/\s+/g, " ");

/* Contrato como o 11281a61: criado às 22:48 de 18/10 em Brasília (01:48 de 19/10 em UTC), assinado antes da troca. */
const CRIADO = "2026-10-19T01:48:00.000+00:00";
const dadosResumo = { contratoId: "11281a61-0000-4000-8000-000000000000", imovel: "Studio Centro", aluguelMensal: 3200, prazoDias: 60, ocupantes: 1, criadoEm: CRIADO, inicioEstadia: "2026-10-19" };
const resumoAtual = resumoContrato(dadosResumo);
const resumoAssinadoUtc = resumoAtual.map((l) => (l.startsWith("Registrado em:") ? "Registrado em: 19/10/2026" : l));
const resumoAssinadoIso = resumoAtual.map((l) => (l.startsWith("Registrado em:") ? "Registrado em: 2026-10-19" : l));

test("(ii) o resumo diz o dia de Brasília: 'Registrado em: 18/10/2026' (era o dia em UTC)", () => {
  assert.ok(resumoAtual.includes("Registrado em: 18/10/2026"), resumoAtual.join(" | "));
  // data pura continua igual (sem fuso)
  assert.ok(resumoContrato({ ...dadosResumo, criadoEm: "2026-10-19" }).includes("Registrado em: 19/10/2026"));
  // a montagem passa o created_at inteiro (não mais o slice em UTC)
  const acoes = ler("src/lib/data/contrato-assinar-actions.ts");
  assert.doesNotMatch(acoes, /created_at\.slice\(0, 10\)/);
  assert.match(acoes, /linhasParaHash\(visao\.resumo, hashDaOutraParte, c\.created_at\)/);
});

test("(ii) compatibilidade de hash: quem assinou o texto antigo (dia em UTC, pt-BR ou ISO) continua conferindo", () => {
  for (const antigo of [resumoAssinadoUtc, resumoAssinadoIso]) {
    const h = hashResumo(antigo);
    assert.notEqual(h, hashResumo(resumoAtual), "o texto mudou de fato");
    assert.equal(hashConfereComResumo(resumoAtual, h, CRIADO), true);
    // a outra parte, ao assinar agora, assina o MESMO texto da primeira
    assert.deepEqual(linhasParaHash(resumoAtual, h, CRIADO), antigo);
    // sem a linha "Início da estadia" (F37) também confere
    const semInicio = antigo.filter((l) => !l.startsWith("Início da estadia:"));
    assert.equal(hashConfereComResumo(resumoAtual, hashResumo(semInicio), CRIADO), true);
  }
  assert.equal(hashConfereComResumo(resumoAtual, hashResumo(resumoAtual), CRIADO), true);
  // um resumo de fato alterado continua "diferente"
  assert.equal(hashConfereComResumo(resumoAtual, hashResumo([...resumoAtual, "Valor mensal: R$ 9.999,00"]), CRIADO), false);
  const pacote = JSON.stringify(
    conteudoPacoteProvas({ contratoId: dadosResumo.contratoId, imovel: "Studio", situacao: "Em vigência", registradoEm: CRIADO, resumo: resumoAtual, assinaturas: [{ papel: "proprietario", em: "2026-10-19T02:00:00Z", hash: hashResumo(resumoAssinadoUtc) }], pagamentos: [], conferencias: [] }),
  );
  // QA do Muse: hash diferente do cabeçalho nunca é "igual" — é o estado 2 (texto anterior do mesmo resumo).
  assert.doesNotMatch(pacote, /\(igual ao resumo atual\)/);
  assert.match(pacote, /confere com o resumo atual — mesmo conteúdo, data registrada no formato anterior \(UTC\)/);
  assert.doesNotMatch(pacote, /diferente do resumo atual/);
});

test("três estados do hash (QA do Muse): 11281a61 = 2, contrato novo = 1, resumo alterado = 3", () => {
  // 11281a61: criado às 22:48 de 18/10 em Brasília, assinado com o dia em UTC ("19/10/2026" ou "2026-10-19").
  for (const antigo of [resumoAssinadoUtc, resumoAssinadoIso]) {
    const c = compararHashComResumo(resumoAtual, hashResumo(antigo), CRIADO);
    assert.equal(c.estado, "variante");
    assert.equal(c.texto, "confere com o resumo atual — mesmo conteúdo, data registrada no formato anterior (UTC)");
  }
  // Contrato novo: assinado com o texto atual.
  assert.deepEqual(compararHashComResumo(resumoAtual, hashResumo(resumoAtual), CRIADO), { estado: "igual", texto: "igual ao resumo atual" });
  // Resumo alterado depois da assinatura.
  assert.deepEqual(compararHashComResumo(resumoAtual, hashResumo([...resumoAtual, "Valor mensal: R$ 9.999,00"]), CRIADO), {
    estado: "diferente",
    texto: "diferente do resumo atual",
  });
  // Antes da linha "Início da estadia": confere, mas não é "mesmo conteúdo".
  const semInicio = compararHashComResumo(resumoAtual, hashResumo(resumoAtual.filter((l) => !l.startsWith("Início da estadia:"))), CRIADO);
  assert.equal(semInicio.estado, "variante");
  assert.doesNotMatch(semInicio.texto, /mesmo conteúdo/);
  // Garantia: "igual" só quando o hash é exatamente o do cabeçalho.
  for (const h of [hashResumo(resumoAssinadoUtc), hashResumo(resumoAssinadoIso), hashResumo(["outro"])]) {
    assert.notEqual(compararHashComResumo(resumoAtual, h, CRIADO).estado, "igual");
  }
});

test("pacote: cabeçalho com o hash atual e cada assinatura com o próprio hash e o estado", () => {
  const atual = hashResumo(resumoAtual);
  const assinado = hashResumo(resumoAssinadoUtc);
  const pacote = JSON.stringify(
    conteudoPacoteProvas({ contratoId: dadosResumo.contratoId, imovel: "Studio", situacao: "Em vigência", registradoEm: CRIADO, resumo: resumoAtual, assinaturas: [{ papel: "proprietario", em: "2026-10-19T02:00:00Z", hash: assinado }, { papel: "inquilino", em: "2026-10-21T02:00:00Z", hash: atual }], pagamentos: [], conferencias: [] }),
  );
  assert.ok(pacote.includes(`"Hash do resumo atual","${atual}"`));
  assert.ok(pacote.includes(`Hash do resumo assinado: ${assinado} (confere com o resumo atual`));
  assert.ok(pacote.includes(`Hash do resumo assinado: ${atual} (igual ao resumo atual)`));
});

test("tela do admin usa o mesmo comparador de três estados (nunca o booleano antigo)", () => {
  const tela = ler("src/app/(dashboard)/admin/contratos/[id]/page.tsx");
  assert.match(tela, /Hash do resumo assinado: \{a\.hash\}/);
  assert.match(tela, /a\.comparacao\.texto/);
  assert.doesNotMatch(tela, /hash igual ao resumo atual/);
  assert.match(ler("src/lib/data/contrato-admin.ts"), /compararHashComResumo\(v\.resumo, a\.hash, base\.criadoEm\)/);
});

/* Pacote do contrato de teste com a conferência confirmada pelas duas partes, 40 itens e pagamentos (um anulado). */
function linhasCompletas(): LinhasProvas {
  return {
    contratoId: dadosResumo.contratoId,
    imovel: "Studio Centro",
    situacao: "Em vigência",
    registradoEm: CRIADO,
    resumo: resumoAtual,
    prazoEntradaEm: "2026-10-21T18:00:00.000Z",
    assinaturas: [
      { papel: "proprietario", assinado_em: "2026-10-19T02:00:00Z", hash_documento: hashResumo(resumoAssinadoUtc) },
      { papel: "inquilino", assinado_em: "2026-10-19T03:00:00Z", hash_documento: hashResumo(resumoAssinadoUtc) },
    ],
    pagamentos: [
      { tipo: "caucao", valor: 3200, forma: "pix", data_pagamento: "2026-10-19", confirmado_pelo_inquilino: true, confirmado_em: "2026-10-19T12:00:00Z", anulado_em: null, anulado_motivo: null },
      { tipo: "caucao", valor: 3200, forma: "pix", data_pagamento: "2026-10-19", confirmado_pelo_inquilino: false, confirmado_em: null, anulado_em: "2026-10-19T15:00:00Z", anulado_motivo: "registro em duplicidade" },
      { tipo: "aluguel", valor: 3200, forma: "pix", data_pagamento: "2026-10-19", confirmado_pelo_inquilino: false, confirmado_em: null },
    ],
    conferencias: [{ id: "c1", tipo: "entrada", criada_em: "2026-10-19T10:00:00Z" }],
    itens: Array.from({ length: 40 }, (_, i) => ({
      conferencia_id: "c1",
      parte: i % 2 ? "inquilino" : "proprietario",
      comodo: `Cômodo ${i + 1}`,
      descricao: `Descrição do item ${i + 1}: paredes sem marcas, piso sem riscos e janela funcionando.`,
      foto_path: i % 3 === 0 ? `uid/foto-${i}.jpg` : null,
    })),
    respostas: [
      { conferencia_id: "c1", parte: "proprietario", decisao: "confirmou", motivo: null, decidido_em: "2026-10-20T13:00:00Z" },
      { conferencia_id: "c1", parte: "inquilino", decisao: "confirmou", motivo: null, decidido_em: "2026-10-20T14:00:00Z" },
    ],
    laudos: [{ conferencia_id: "c1", path: "uid-do-dono/laudo-sala.pdf", parte: "proprietario", criado_em: "2026-10-20T12:00:00Z" }],
  };
}

test("F4 + conteúdo: pacote com a conferência confirmada tem 2+ páginas e 'confirmou a conferência de entrada' das duas partes", async () => {
  const completo = montarDadosProvas(linhasCompletas());
  const pdf = await gerarPdf(conteudoPacoteProvas(completo));
  assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 2);
  const t = plano(await textoDoPdf(pdf));
  assert.ok(t.includes("O proprietário confirmou a conferência de entrada"));
  assert.ok(t.includes("O inquilino confirmou a conferência de entrada"));
  assert.ok(t.includes("Conferência de entrada: Confirmada pelas duas partes."));
  assert.ok(t.includes("Prazo para registrar e responder: até 21/10 às 15:00, horário de Brasília."));
  // itens: cômodo + descrição, sem foto; "N fotos na plataforma"
  assert.ok(t.includes("- Cômodo 40: Descrição do item 40"), "o último item não some");
  assert.ok(t.includes("Itens do proprietário (20 itens; 7 fotos na plataforma):"), t.slice(t.indexOf("Itens do proprietário"), t.indexOf("Itens do proprietário") + 80));
  assert.ok(t.includes("Itens do inquilino (20 itens; 7 fotos na plataforma):"));
  assert.doesNotMatch(t, /foto-\d+\.jpg|uid\//);
  // laudo: só o nome
  assert.ok(t.includes("laudo-sala.pdf"));
  assert.doesNotMatch(t, /uid-do-dono/);
  // rodapé novo
  assert.ok(t.includes("As fotos ficam na tela da conferência."));
  // (iii) situação pelo selo
  assert.ok(t.includes("Situação Em vigência"));
  assert.doesNotMatch(t, /Situação ativo/);
  // a última linha do tempo também está no PDF
  assert.ok(t.includes("O inquilino confirmou a conferência de entrada."));
  assert.ok(t.includes("página 1 de"));
});

test("conteúdo: contestação aparece com data/hora e o motivo", () => {
  const d = montarDadosProvas({
    contratoId: "x",
    imovel: "Studio",
    situacao: "Em vigência",
    registradoEm: CRIADO,
    resumo: ["MINUTA"],
    prazoEntradaEm: null,
    assinaturas: [],
    pagamentos: [],
    conferencias: [{ id: "c1", tipo: "entrada", criada_em: "2026-10-19T10:00:00Z" }],
    itens: [{ conferencia_id: "c1", parte: "proprietario", comodo: "Sala", descricao: "Sofá", foto_path: null }],
    respostas: [{ conferencia_id: "c1", parte: "inquilino", decisao: "contestou", motivo: "O sofá tem um rasgo.", decidido_em: "2026-10-20T14:32:00Z" }],
    laudos: [],
  });
  const t = conteudoPacoteProvas(d).corpo.join("\n");
  assert.match(t, /O inquilino contestou a conferência de entrada em 20\/10\/2026 às 11:32\. Motivo: O sofá tem um rasgo\./);
  assert.match(t, /Conferência de entrada: Contestada\./);
  assert.match(t, /Itens do inquilino: nenhum registrado\./);
});

test("(i) pagamento anulado aparece UMA vez, com a marca, e fica fora dos totais e do 'aguardando'", () => {
  const pags = [
    { tipo: "caucao" as const, valor: 3200, forma: "pix", dia: "2026-10-19", confirmadoEm: "2026-10-19T12:00:00Z" },
    { tipo: "caucao" as const, valor: 3200, forma: "pix", dia: "2026-10-19", confirmadoEm: null, anuladoEm: "2026-10-19T15:00:00Z", anuladoMotivo: "registro em duplicidade" },
    { tipo: "aluguel" as const, valor: 1000, forma: "pix", dia: "2026-10-19", confirmadoEm: null },
  ];
  assert.deepEqual(totaisPagamentos(pags), { confirmado: 3200, aguardando: 1000, anulados: 1 });
  const d: DadosProvas = { contratoId: "x", imovel: "S", situacao: "Em vigência", registradoEm: CRIADO, resumo: ["M"], assinaturas: [], pagamentos: pags, conferencias: [] };
  const ev = eventosDoContrato(d).filter((e) => /Caução/.test(e.texto));
  const anulados = ev.filter((e) => /registro anulado/.test(e.texto));
  assert.equal(anulados.length, 1);
  assert.equal(anulados[0].texto, "Caução de R$ 3.200,00 marcado como pago pelo proprietário (Pix, em 19/10/2026) — registro anulado em 19/10/2026 às 12:00 (registro em duplicidade).");
  assert.doesNotMatch(anulados[0].texto, /aguardando/);
  const corpo = conteudoPacoteProvas(d).corpo.join("\n");
  assert.match(corpo, /Confirmados pelo inquilino: R\$ 3\.200,00\. Aguardando confirmação do inquilino: R\$ 1\.000,00\./);
  assert.match(corpo, /1 registro anulado fica fora dos totais\./);
  // a carga lê as colunas da anulação (as partes e o admin)
  assert.match(ler("src/lib/contrato-provas.ts"), /anulado_em, anulado_motivo/);
  assert.match(ler("src/lib/data/contrato-provas.ts"), /COLUNAS_PROVAS\.pagamentos/);
});

test("(iii) 'Situação' é o selo da fonte única, nunca o status cru", () => {
  const carga = ler("src/lib/data/contrato-provas.ts");
  assert.match(carga, /situacao: visao\.estado\.selo/);
  assert.doesNotMatch(carga, /status: visao\.status/);
  assert.equal(seloParaEquipe({ status: "ativo", assinado_proprietario_em: "x", assinado_inquilino_em: "y", pagamentos_bloco: [{ tipo: "aluguel", confirmado_pelo_inquilino: true }] }), "Em vigência");
  assert.equal(seloParaEquipe({ status: "ativo", assinado_proprietario_em: "x", assinado_inquilino_em: null }), "Aguardando assinatura · falta o inquilino");
  assert.equal(seloParaEquipe({ status: "ativo" }), "Aguardando assinatura · faltam as duas partes");
  assert.equal(seloParaEquipe({ status: "cancelado" }), "Cancelado");
});

test("admin: pacote gerado pela equipe leva 'Gerado pela equipe Viva Nomads em [data/hora]'", async () => {
  const d: DadosProvas = { contratoId: "x", imovel: "S", situacao: "Em vigência", registradoEm: CRIADO, resumo: ["M"], assinaturas: [], pagamentos: [], conferencias: [], geradoPelaEquipeEm: "2026-10-20T18:05:00Z" };
  const t = plano(await textoDoPdf(await gerarPdf(conteudoPacoteProvas(d))));
  assert.ok(t.includes("Gerado pela equipe Viva Nomads em 20/10/2026 às 15:05 (horário de Brasília)."));
  const semEquipe = JSON.stringify(conteudoPacoteProvas({ ...d, geradoPelaEquipeEm: null }));
  assert.doesNotMatch(semEquipe, /Gerado pela equipe/);
});

test("admin › contrato: guarda ehAdmin no servidor ANTES do cliente de serviço; 404 para quem não é admin; registro de acesso", () => {
  const pagina = ler("src/app/(dashboard)/admin/contratos/[id]/page.tsx");
  assert.match(pagina, /if \(!user \|\| !\(await ehAdmin\(supabase, user\.id\)\)\) notFound\(\);/);
  assert.ok(pagina.indexOf("ehAdmin(supabase") < pagina.indexOf("carregarContratoAdmin(id)"), "checa antes de ler");
  assert.match(pagina, /logModeracao\(supabase, user\.id, "ver_contrato", "contrato", id\)/);
  assert.doesNotMatch(pagina, /createAdminClient/);
  assert.match(pagina, /\/api\/admin\/contratos\/\$\{c\.id\}\/provas/);
  assert.match(pagina, /Baixar pacote de provas/);

  const carga = ler("src/lib/data/contrato-admin.ts");
  assert.ok(carga.indexOf("await getContratoParaEquipe(contratoId)") < carga.indexOf("createAdminClient()"), "cliente de serviço só depois da checagem");
  const acoes = ler("src/lib/data/contrato-assinar-actions.ts");
  const fn = acoes.slice(acoes.indexOf("export async function getContratoParaEquipe"));
  assert.ok(fn.indexOf("ehAdmin(supabase, user.id)") > 0 && fn.indexOf("ehAdmin(supabase, user.id)") < fn.indexOf("createAdminClient()"));

  const rota = ler("src/app/api/admin/contratos/[id]/provas/route.ts");
  assert.match(rota, /ehAdmin\(supabase, user\.id\)/);
  assert.match(rota, /status: 404/);
  assert.match(rota, /geradoPelaEquipeEm: new Date\(\)\.toISOString\(\)/);
  assert.match(rota, /private, no-store/);

  const lista = ler("src/app/(dashboard)/admin/contratos/page.tsx");
  assert.match(lista, /href=\{`\/admin\/contratos\/\$\{c\.id\}`\}/);
  assert.doesNotMatch(lista, /\/dashboard\/contratos\/\$\{c\.id\}/);
  assert.match(lista, /Conferência de entrada:/);
  assert.match(lista, /estadosConferenciaEntrada\(admin,/);
});

test("F3: o campo da foto é recriado (chave nova) depois de adicionar o item", () => {
  const tela = ler("src/components/contrato/conferencia-contrato.tsx");
  assert.match(tela, /<input type="file" key=\{chaveFoto\}/);
  assert.match(tela, /setChaveFoto\(\(k\) => k \+ 1\)/);
  assert.match(tela, /Foto escolhida: \{foto\.name\}/);
});
