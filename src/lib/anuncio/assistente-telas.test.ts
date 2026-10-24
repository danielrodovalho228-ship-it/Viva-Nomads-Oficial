/*
  Assistente de cadastro em 10 passos — textos e regras puras das telas (mockups cadastro-imovel-01..10).
  Roda: node --test src/lib/anuncio/assistente-telas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TELAS_ASSISTENTE, TEXTOS_REVISAO, TIPOS_ASSISTENTE, linhaPrevia, linhaRevisao, localPrevia, progressoPasso, textoPasso, tituloPrevia } from "./assistente-telas.ts";
import { ETAPAS_ASSISTENTE } from "./assistente-dez-etapas.ts";
import { PROPERTY_TYPES } from "../amenities.ts";
import { PHOTOS } from "../media.ts";

test("10 telas com o título dos mockups, na ordem do mapa de dados", () => {
  assert.equal(TELAS_ASSISTENTE.length, 10);
  assert.deepEqual(
    TELAS_ASSISTENTE.map((t) => t.titulo),
    ["Qual é o tipo do seu imóvel?", "Adicione as fotos do imóvel", "Onde fica o imóvel?", "Detalhes do imóvel", "O que o imóvel oferece?", "Regras da casa", "Título e descrição do anúncio", "Quanto custa por mês?", "Disponibilidade", "Revise e publique"],
  );
  assert.equal(ETAPAS_ASSISTENTE.length, TELAS_ASSISTENTE.length);
});

test("vocabulário da casa: sem hóspede, viajante, reserva, check-in, temporada nem comissão", () => {
  const textos = TELAS_ASSISTENTE.map((t) => `${t.rotulo} ${t.titulo} ${t.subtitulo}`).join(" ") + TIPOS_ASSISTENTE.map((t) => `${t.rotulo} ${t.alt}`).join(" ");
  assert.doesNotMatch(textos, /hósped|viajante|reserva|check-in|temporada|comiss/i);
  assert.match(TELAS_ASSISTENTE[2].subtitulo, /moradores/);
});

test("'Passo X de 10' e a barra de progresso", () => {
  assert.equal(textoPasso(0), "Passo 1 de 10");
  assert.equal(textoPasso(9), "Passo 10 de 10");
  assert.equal(progressoPasso(0), 10);
  assert.equal(progressoPasso(5), 60);
  assert.equal(progressoPasso(9), 100);
});

test("01-b (E87): os 9 tipos num array só, na ordem pedida — nenhum tipo do catálogo some", () => {
  assert.deepEqual(TIPOS_ASSISTENTE.map((t) => t.rotulo), ["Casa", "Apartamento", "Quarto", "Studio", "Loft", "Cobertura", "Casa de condomínio", "Flat/apart-hotel", "Chácara/Sítio"]);
  assert.deepEqual(TIPOS_ASSISTENTE.map((t) => t.valor).sort(), PROPERTY_TYPES.map((t) => t.value).sort());
  for (const t of TIPOS_ASSISTENTE) assert.match(t.alt, /^Foto ilustrativa de /, `alt descreve o tipo: ${t.valor}`);
});

test("E102-A: subtítulo do Passo 9 sem 'aluguel'", () => {
  assert.equal(TELAS_ASSISTENTE[8].subtitulo, "Escolha a partir de quando o imóvel está disponível e as datas que ficam fechadas.");
  assert.doesNotMatch(TELAS_ASSISTENTE.map((t) => `${t.titulo} ${t.subtitulo}`).join(" "), /alugu/i);
});

test("prévia: o título do dono; sem título, tipo + bairro como no desenho", () => {
  assert.equal(tituloPrevia("", "apartamento", "Santa Mônica"), "Apartamento no Santa Mônica");
  assert.equal(tituloPrevia("  Studio no Centro ", "studio", "Centro"), "Studio no Centro");
  assert.equal(tituloPrevia("", "quarto", ""), "Quarto privativo");
  assert.equal(tituloPrevia("", "", ""), "Seu imóvel");
});

test("prévia: '2 quartos · 65 m²' só com o que existe; lugar com a UF", () => {
  assert.equal(linhaPrevia(2, 65), "2 quartos · 65 m²");
  assert.equal(linhaPrevia(1, 0), "1 quarto");
  assert.equal(linhaPrevia(0, 30), "30 m²");
  assert.equal(linhaPrevia(0, 0), "");
  assert.equal(localPrevia("Santa Mônica", "Uberlândia", "mg"), "Santa Mônica, Uberlândia - MG"); // E101: a mesma linha pública do anúncio
  assert.equal(localPrevia("", "", ""), "");
});

test("tela Tipo (01-b): rádios acessíveis numa linha rolável; foto em TODO cartão, de PHOTOS.cadastro, com o selo; sem chips", () => {
  const tela = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/etapa-tipo.tsx", import.meta.url), "utf8");
  assert.match(tela, /role="radiogroup"\s+aria-label="Tipo do imóvel"/);
  assert.match(tela, /role="radio"\s+aria-checked=\{on\}/);
  assert.match(tela, /snap-x snap-mandatory/, "no celular, desliza com encaixe");
  assert.match(tela, /disabled=\{bordas\.inicio\}[\s\S]*?tipos-seta-esquerda/, "seta da esquerda desativada no início");
  assert.match(tela, /disabled=\{bordas\.fim\}[\s\S]*?tipos-seta-direita/, "seta da direita desativada no fim");
  assert.match(tela, /\{SELO_ILUSTRATIVA\}/);
  assert.match(tela, /alt=\{t\.alt\}/);
  assert.doesNotMatch(tela, /Outros tipos|rounded-full border px-4/, "sem a seção 'Outros tipos' e sem chips");
  assert.doesNotMatch(tela, /: null/, "nenhum cartão sem foto");
  // Os caminhos combinados: Apartamento e Quarto ficam com as atuais; as outras sete em public/images/imoveis/.
  assert.deepEqual(
    [PHOTOS.cadastro.tipoCasa, PHOTOS.cadastro.tipoStudio, PHOTOS.cadastro.tipoLoft, PHOTOS.cadastro.tipoCobertura, PHOTOS.cadastro.tipoCasaCondominio, PHOTOS.cadastro.tipoFlat, PHOTOS.cadastro.tipoChacara],
    ["tipo-casa", "tipo-studio", "tipo-loft", "tipo-cobertura", "tipo-casa-condominio", "tipo-flat", "placeholder-imovel-chacara"].map((n) => `/images/imoveis/${n}.webp`),
  );
  assert.equal(PHOTOS.cadastro.tipoApartamento, "/images/imoveis/placeholder-imovel-fachada.webp");
  assert.equal(PHOTOS.cadastro.tipoQuarto, "/images/imoveis/placeholder-imovel-quarto.webp");
  for (const t of TIPOS_ASSISTENTE) assert.match(tela, new RegExp(`${t.valor}: PHOTOS\\.cadastro\\.`), `foto do tipo ${t.valor}`);
});

test("revisão (cadastro-imovel-10): a linha do cartão e os textos sem hóspede nem cobrança pela plataforma", () => {
  assert.equal(linhaRevisao(1, 1, 40), "1 quarto · 1 banheiro · 40 m²");
  assert.equal(linhaRevisao(2, 2, 65), "2 quartos · 2 banheiros · 65 m²");
  assert.equal(linhaRevisao(0, 1, 0), "1 banheiro");
  assert.equal(linhaRevisao(0, 0, 0), "");
  assert.equal(TEXTOS_REVISAO.lista, "Lista de conferência");
  assert.equal(TEXTOS_REVISAO.listaTudoCerto, "Tudo certo para publicar");
  for (const t of Object.values(TEXTOS_REVISAO)) assert.doesNotMatch(String(t), /h[oó]spede|cobrad|comiss|reserva/i);
});
