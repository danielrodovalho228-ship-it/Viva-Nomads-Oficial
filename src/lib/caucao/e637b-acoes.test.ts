/*
  E637 (b) — as ações dos prazos da caução, ATRÁS DA MESMA TRAVA (CAUCAO_PRAZOS_ATIVA, desligada):
   • o DONO dá o parecer em até 7 dias, com cada desconto provado (foto de entrada, foto de saída, valor e comprovante);
   • o MORADOR contesta em até 5 dias, item a item;
   • o dono registra a devolução (regulariza a pendência);
   • o DOSSIÊ em PDF (fotos de entrada e saída lado a lado, valores, comprovantes) vai às duas partes; a Viva nunca decide.
  Roda: node --test src/lib/caucao/e637b-acoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { caminhoDeComprovanteValido, podeContestar, podeDarParecer } from "./acoes-regras.ts";
import { linhasDoDossie, montarDossiePdf } from "./dossie.ts";
import { TEXTO_VIVA_NAO_DECIDE, type ItemDesconto } from "./prazos.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("parecer: só o dono, uma vez, até o dia 7 (inclusive)", () => {
  assert.deepEqual(podeDarParecer({ saida: "2026-11-06", parecerEm: null, hoje: "2026-11-13" }), { ok: true });
  const tarde = podeDarParecer({ saida: "2026-11-06", parecerEm: null, hoje: "2026-11-14" });
  assert.equal(tarde.ok, false);
  if (!tarde.ok) assert.match(tarde.motivo, /liberação integral/i);
  const duas = podeDarParecer({ saida: "2026-11-06", parecerEm: "2026-11-08", hoje: "2026-11-09" });
  assert.equal(duas.ok, false);
  if (!duas.ok) assert.match(duas.motivo, /já deu o parecer/i);
});

test("a saída ainda não aconteceu: ainda não dá parecer", () => {
  const r = podeDarParecer({ saida: "2026-11-20", parecerEm: null, hoje: "2026-11-10" });
  assert.equal(r.ok, false);
});

const item = (status: ItemDesconto["status"] = "proposto"): Pick<ItemDesconto, "status"> => ({ status });

test("contestação: só o morador, item a item, em até 5 dias contados do parecer", () => {
  assert.deepEqual(podeContestar({ parecerEm: "2026-11-09", hoje: "2026-11-14", item: item() }), { ok: true });
  const fora = podeContestar({ parecerEm: "2026-11-09", hoje: "2026-11-15", item: item() });
  assert.equal(fora.ok, false);
  const jaFoi = podeContestar({ parecerEm: "2026-11-09", hoje: "2026-11-10", item: item("contestado") });
  assert.equal(jaFoi.ok, false);
  const semParecer = podeContestar({ parecerEm: null, hoje: "2026-11-10", item: item() });
  assert.equal(semParecer.ok, false);
});

test("o comprovante precisa estar na pasta de quem envia e ser PDF ou imagem", () => {
  const uid = "11111111-1111-4111-8111-111111111111";
  assert.equal(caminhoDeComprovanteValido(`${uid}/22222222-2222-4222-8222-222222222222.pdf`, uid), true);
  assert.equal(caminhoDeComprovanteValido(`${uid}/22222222-2222-4222-8222-222222222222.jpg`, uid), true);
  assert.equal(caminhoDeComprovanteValido(`outro/22222222-2222-4222-8222-222222222222.pdf`, uid), false);
  assert.equal(caminhoDeComprovanteValido(`${uid}/../x.pdf`, uid), false);
  assert.equal(caminhoDeComprovanteValido(`${uid}/arquivo.exe`, uid), false);
});

const itens = [
  { id: "i1", categoria: "dano", comodo: "Sala", valor: 300, status: "proposto" as const, contestacao: null },
  { id: "i2", categoria: "sujeira_excessiva", comodo: "Cozinha", valor: 120.5, status: "contestado" as const, contestacao: "Já estava assim na entrada" },
];

test("dossiê: linhas com contrato, prazos, itens, contestação e o texto de que a Viva não decide", () => {
  const l = linhasDoDossie({ numero: "VN-CT-AB12CD34", imovel: "Apto Santa Mônica", proprietario: "Marcos Lima", inquilino: "Ana Souza", saida: "2026-11-06", parecerEm: "2026-11-09", itens });
  const texto = l.join("\n");
  assert.match(texto, /VN-CT-AB12CD34/);
  assert.match(texto, /Sala/);
  assert.match(texto, /R\$ 300,00/);
  assert.match(texto, /Já estava assim na entrada/);
  assert.match(texto, /Parecer do proprietário: 09\/11\/2026/);
  assert.ok(texto.includes(TEXTO_VIVA_NAO_DECIDE));
  for (const s of ["Acordo entre as partes", "Vistoriador parceiro", "Juizado Especial"]) assert.match(texto, new RegExp(s));
  assert.doesNotMatch(texto, /desgaste natural.*desconto aceito/i);
});

test("dossiê em PDF: uma página de resumo e uma por item, com as fotos de entrada e saída lado a lado", async () => {
  const foto = (cor: { r: number; g: number; b: number }) => sharp({ create: { width: 800, height: 600, channels: 3, background: cor } }).jpeg().toBuffer();
  const [a, b] = await Promise.all([foto({ r: 200, g: 40, b: 40 }), foto({ r: 40, g: 40, b: 200 })]);
  const pdf = await montarDossiePdf({
    resumo: linhasDoDossie({ numero: "VN-CT-AB12CD34", imovel: "Apto", proprietario: "Marcos", inquilino: "Ana", saida: "2026-11-06", parecerEm: "2026-11-09", itens }),
    itens: itens.map((i) => ({ ...i, fotoEntrada: new Uint8Array(a), fotoSaida: new Uint8Array(b), comprovante: "comprovante recebido" })),
  });
  const lido = await PDFDocument.load(pdf);
  assert.equal(lido.getPageCount(), 1 + itens.length);
  assert.ok(pdf.length > 3000);
});

test("dossiê sem foto legível não quebra: a página do item diz que a foto não pôde ser lida", async () => {
  const pdf = await montarDossiePdf({ resumo: ["x"], itens: [{ ...itens[0], fotoEntrada: null, fotoSaida: null, comprovante: null }] });
  assert.equal((await PDFDocument.load(pdf)).getPageCount(), 2);
});

test("ações: atrás da chave, com a parte conferida e a prova exigida de novo no servidor", () => {
  const a = ler("src/lib/caucao/acoes.ts");
  assert.match(a, /"use server"/);
  assert.equal((a.match(/if \(!CAUCAO_PRAZOS_ATIVA\)/g) ?? []).length, 3);
  assert.match(a, /export async function darParecerCaucao\(/);
  assert.match(a, /export async function contestarDescontoCaucao\(/);
  assert.match(a, /export async function registrarDevolucaoCaucao\(/);
  assert.match(a, /descontoValido\(/);
  assert.match(a, /podeDarParecer\(/);
  assert.match(a, /podeContestar\(/);
  assert.match(a, /owner_id !== user\.id/);
  assert.match(a, /tenant_id !== user\.id/);
  assert.match(a, /tipo[\s\S]*"entrada"/);
  assert.match(a, /tipo[\s\S]*"saida"/);
  assert.match(a, /caminhoDeComprovanteValido\(/);
});

test("dossiê: rota atrás da chave, só as partes (RLS), PDF inline sem cache e sem a decisão da Viva", () => {
  const r = ler("src/app/api/caucao/dossie/route.ts");
  assert.match(r, /if \(!CAUCAO_PRAZOS_ATIVA\)/);
  assert.match(r, /auth\.getUser\(\)/);
  assert.match(r, /"Cache-Control": "private, no-store/);
  assert.match(r, /application\/pdf/);
  assert.match(r, /montarDossiePdf\(/);
});
