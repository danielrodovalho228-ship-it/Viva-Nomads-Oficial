/*
  F40 — assinatura na plataforma: papéis, resumo/hash, quem pode assinar, aviso por parte e janela de avaliação.
  Roda: node --test src/lib/contrato-assinar.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assuntoAvisoOutraParte,
  avisoAssinatura,
  hashResumo,
  linhasParaHash,
  motivoNaoPodeAssinar,
  papelNoContrato,
  podeAvaliarLocacao,
  resumoContrato,
  petsRegrasDoResumo,
  limpezaDoContrato,
} from "./contrato-assinar.ts";
import { qtdPetsCongelada, type RegrasPets } from "./anuncio/pets-regras.ts";

const dados = { contratoId: "c1", imovel: "Studio Centro", aluguelMensal: 2500, prazoDias: 90, ocupantes: 1, criadoEm: "2026-10-13" };

test("papel: inquilino, proprietário e quem não é parte", () => {
  assert.equal(papelNoContrato("t", "t", "o"), "inquilino");
  assert.equal(papelNoContrato("o", "t", "o"), "proprietario");
  assert.equal(papelNoContrato("x", "t", "o"), null);
});

test("resumo leva a marca de minuta e o hash muda se qualquer valor mudar", () => {
  const r = resumoContrato(dados);
  assert.equal(r[0], "MINUTA DE TESTE — sem validade");
  assert.match(hashResumo(r), /^[0-9a-f]{64}$/);
  assert.equal(hashResumo(r), hashResumo(resumoContrato(dados)));
  assert.notEqual(hashResumo(r), hashResumo(resumoContrato({ ...dados, aluguelMensal: 2600 })));
});

test("assinar: caso positivo e os negativos (não é parte, não ativo, já assinou, sem aceite)", () => {
  const ok = { status: "ativo", papel: "inquilino" as const, assinadoEm: null, aceite: true };
  assert.equal(motivoNaoPodeAssinar(ok), null);
  assert.match(motivoNaoPodeAssinar({ ...ok, papel: null })!, /não é parte/);
  assert.match(motivoNaoPodeAssinar({ ...ok, status: "cancelado" })!, /não está mais aguardando/);
  assert.match(motivoNaoPodeAssinar({ ...ok, assinadoEm: "2026-10-13" })!, /já assinou/);
  assert.match(motivoNaoPodeAssinar({ ...ok, aceite: false })!, /Li e concordo/);
});

test("aviso: cada parte vê 'você já assinou / falta o outro'", () => {
  const t = "2026-10-13";
  assert.equal(avisoAssinatura("inquilino", { proprietario: null, inquilino: t }), "Você já assinou — falta o outro assinar.");
  assert.equal(avisoAssinatura("proprietario", { proprietario: null, inquilino: t }), "O outro já assinou — falta você assinar.");
  assert.equal(avisoAssinatura("inquilino", { proprietario: t, inquilino: t }), "As duas partes assinaram.");
  assert.equal(avisoAssinatura("inquilino", { proprietario: null, inquilino: null }), "Nenhuma assinatura ainda.");
});

test("avaliar: nunca em contrato ativo/aguardando assinatura; só até 14 dias depois do fim", () => {
  const agora = new Date("2026-10-20T12:00:00Z");
  assert.equal(podeAvaliarLocacao("ativo", null, agora), false);
  assert.equal(podeAvaliarLocacao("ativo", "2026-10-19T00:00:00Z", agora), false);
  assert.equal(podeAvaliarLocacao("concluido", "2026-10-15T00:00:00Z", agora), true);
  assert.equal(podeAvaliarLocacao("concluido", "2026-09-01T00:00:00Z", agora), false);
  assert.equal(podeAvaliarLocacao("concluido", null, agora), false);
});

test("aviso à outra parte: pede a assinatura que falta, ou diz que o contrato está completo", () => {
  assert.equal(assuntoAvisoOutraParte(false), "O outro lado assinou o contrato — falta a sua assinatura");
  assert.equal(assuntoAvisoOutraParte(true), "As duas partes assinaram o contrato");
  assert.doesNotMatch(assuntoAvisoOutraParte(true), /falta/);
});

test("resumo traz a cláusula de pets só quando o anúncio tem regras (ordem 022afabb, item 5)", () => {
  const sem = resumoContrato(dados);
  assert.ok(!sem.some((l) => l.startsWith("Pets")));
  const regras = { especies: ["cao" as const, "gato" as const], porteMax: "M" as const, qtdMax: 2, reforcoCaucao: 0, valorPet: 500, valorPetTipo: "reembolsavel" as const, regrasCondominio: "" };
  const com = resumoContrato({ ...dados, petsRegras: regras });
  const linha = com.find((l) => l.startsWith("Pets"))!;
  assert.match(linha, /cão e gato/);
  assert.doesNotMatch(linha, /Caução pet|Taxa pet/, "o valor pet vai em linha própria, não dentro de 'Pets —'");
  assert.notEqual(hashResumo(sem), hashResumo(com));
  assert.ok(!/vistoria/i.test(linha));
});

test("dono assina, o anúncio muda as regras de pets e o inquilino assina o mesmo hash (achado do Moacir, PR #486)", () => {
  const antes = { especies: ["cao"], porteMax: "M", qtdMax: 1, reforcoCaucao: 0, regrasCondominio: "" };
  const depois = { especies: ["cao", "gato"], porteMax: "G", qtdMax: 3, reforcoCaucao: 900, regrasCondominio: "" };
  // 1ª assinatura (ninguém assinou): vale o anúncio; o servidor congela essas regras no contrato.
  const hashDono = hashResumo(
    resumoContrato({ ...dados, petsRegras: petsRegrasDoResumo({ algumaAssinatura: false, vivas: antes, congeladas: null }) }),
  );
  // 2ª assinatura: o dono já mudou o anúncio, mas vale o congelado.
  const hashInquilino = hashResumo(
    resumoContrato({ ...dados, petsRegras: petsRegrasDoResumo({ algumaAssinatura: true, vivas: depois, congeladas: antes }) }),
  );
  assert.equal(hashInquilino, hashDono);
  // Contrato já assinado antes do congelamento existir: sem a linha, como quando foi assinado.
  assert.equal(petsRegrasDoResumo({ algumaAssinatura: true, vivas: depois, congeladas: null }), null);
  // Congelado vazio ({}): anúncio sem regras na 1ª assinatura continua sem a linha.
  assert.equal(petsRegrasDoResumo({ algumaAssinatura: true, vivas: depois, congeladas: {} }), null);
});

test("resumo mostra a data de início da estadia escolhida no Fechamento (F37) e o hash acompanha", () => {
  const sem = resumoContrato(dados);
  assert.ok(!sem.some((l) => l.startsWith("Início da estadia")));
  const com = resumoContrato({ ...dados, inicioEstadia: "2026-11-03" });
  assert.ok(com.includes("Início da estadia: 03/11/2026"));
  assert.notEqual(hashResumo(sem), hashResumo(com));
  assert.notEqual(hashResumo(com), hashResumo(resumoContrato({ ...dados, inicioEstadia: "2026-11-04" })));
  // Data inválida não vira lixo no resumo assinado.
  assert.ok(!resumoContrato({ ...dados, inicioEstadia: "03/11/2026" }).some((l) => l.startsWith("Início da estadia")));
});

test("valor pet no resumo: linha própria, só com pet na candidatura (ordem 0a746da1, parte 3b)", () => {
  const base = { especies: ["cao" as const], porteMax: "M" as const, qtdMax: 2, reforcoCaucao: 0, regrasCondominio: "" };
  const reemb = { ...base, valorPet: 500, valorPetTipo: "reembolsavel" as const };
  const taxa = { ...base, valorPet: 300, valorPetTipo: "nao_reembolsavel" as const };
  const linhaValor = (r: RegrasPets, qtd?: number) =>
    resumoContrato({ ...dados, petsRegras: r, qtdPetsCandidatura: qtd }).find((l) => l.startsWith("Valor pet"));
  assert.equal(linhaValor(reemb, 1), "Valor pet: Caução pet R$ 500,00 — devolvida no fim");
  assert.equal(linhaValor(taxa, 2), "Valor pet: Taxa pet R$ 300,00 — não reembolsável");
  // Negativos: candidatura sem pet, sem valor no anúncio ou sem regras → nenhuma linha.
  assert.equal(linhaValor(reemb, 0), undefined);
  assert.equal(linhaValor(reemb, undefined), undefined);
  assert.equal(linhaValor(base, 1), undefined);
  assert.ok(!resumoContrato({ ...dados, qtdPetsCandidatura: 1 }).some((l) => l.startsWith("Valor pet")));
  // A linha muda o hash (as duas partes assinam o que leram).
  assert.notEqual(
    hashResumo(resumoContrato({ ...dados, petsRegras: reemb, qtdPetsCandidatura: 1 })),
    hashResumo(resumoContrato({ ...dados, petsRegras: reemb, qtdPetsCandidatura: 0 })),
  );
});

test("pets congelados no contrato: lê a quantidade só se válida", () => {
  assert.equal(qtdPetsCongelada({ qtdPetsCandidatura: 2 }), 2);
  for (const ruim of [null, {}, { qtdPetsCandidatura: 0 }, { qtdPetsCandidatura: 9 }, { qtdPetsCandidatura: "x" }, "a"]) {
    assert.equal(qtdPetsCongelada(ruim), 0);
  }
});

test("achado #553: quem assina depois de quem assinou sem 'Início da estadia' fica com o mesmo hash", () => {
  const base = { contratoId: "c1", imovel: "Apto", aluguelMensal: 2500, prazoDias: 90, ocupantes: 1, criadoEm: "2026-10-01" };
  const sem = resumoContrato(base);
  const com = resumoContrato({ ...base, inicioEstadia: "2026-11-01" });
  const hashAntigo = hashResumo(sem);
  assert.equal(hashResumo(linhasParaHash(com, hashAntigo)), hashAntigo);
  // sem assinatura anterior, ou com hash novo, nada muda
  assert.deepEqual(linhasParaHash(com, null), com);
  assert.deepEqual(linhasParaHash(com, hashResumo(com)), com);
});

test("resumo do contrato traz a quantidade de limpezas por mês; sem pacote, o resumo (e o hash) não muda", () => {
  const semPacote = resumoContrato(dados);
  const comPacote = resumoContrato({ ...dados, limpezaEstadia: { porMes: 4, inclui: "Tudo", valorMes: 0 } });
  assert.ok(comPacote.some((l) => /^Limpeza durante a estadia — 4 limpezas por mês/.test(l)));
  assert.ok(!semPacote.some((l) => /Limpeza durante a estadia/.test(l)));
  assert.deepEqual(resumoContrato({ ...dados, limpezaEstadia: null }), semPacote);
  assert.notEqual(hashResumo(comPacote), hashResumo(semPacote));
});

test("limpezaDoContrato: ao vivo antes da assinatura, congelada depois (as duas partes assinam o mesmo texto)", () => {
  const pacote = { porMes: 1, inclui: "", valorMes: 90 };
  assert.equal(limpezaDoContrato({ algumaAssinatura: false, viva: pacote, congeladas: {} })?.porMes, 1);
  assert.equal(limpezaDoContrato({ algumaAssinatura: true, viva: null, congeladas: { limpezaEstadia: pacote } })?.valorMes, 90);
  // dono mudou o anúncio depois da 1ª assinatura: vale o congelado
  assert.equal(limpezaDoContrato({ algumaAssinatura: true, viva: { porMes: 4, inclui: "", valorMes: 1 }, congeladas: { limpezaEstadia: pacote } })?.porMes, 1);
  // contrato antigo, sem a chave: sem linha
  assert.equal(limpezaDoContrato({ algumaAssinatura: true, viva: pacote, congeladas: { especies: ["cao"] } }), null);
  assert.equal(limpezaDoContrato({ algumaAssinatura: true, viva: pacote, congeladas: null }), null);
});
