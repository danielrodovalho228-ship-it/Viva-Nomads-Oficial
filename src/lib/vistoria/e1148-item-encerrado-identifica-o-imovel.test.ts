import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { identificacaoDoImovel, regiaoDoItemEncerrado } from "./pedido-avaliador.ts";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1148 (ORDENS-DUET 634, 678 e 679; linha Parceiros, classe B). No histórico do avaliador, o item encerrado que já não é
  dele — a proposta que expirou, a que o dono descartou, o pedido que ele recusou, a ausência — dizia só "rótulo · cidade
  · porte · data". Dois itens da mesma cidade e do mesmo porte eram indistinguíveis.
  O item passa a dizer de que imóvel é: o título do anúncio, o código VN e o bairro. SEM a morada completa (nestes itens
  o dono não aceitou; a regra da casa é bairro e cidade antes do aceite) e SEM ligação (a tela do pedido já não abre
  para um pedido que não é do avaliador, e o item não manda para a página pública).
  Roda: node --test src/lib/vistoria/e1148-item-encerrado-identifica-o-imovel.test.ts
*/
const PAGINA = "src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx";
const pagina = fonteSemComentarios(readFileSync(PAGINA, "utf8"));
/** O item encerrado, do <li> ao </li>. */
const item = (() => {
  const i = pagina.indexOf('data-testid="avaliacao-fora"');
  const ini = pagina.lastIndexOf("<li", i);
  return pagina.slice(ini, pagina.indexOf("</li>", i));
})();

test("E1148: o bairro e a cidade do item encerrado — nunca vazio, nunca a morada", () => {
  assert.equal(regiaoDoItemEncerrado("Saraiva", "Uberlândia"), "Saraiva · Uberlândia");
  assert.equal(regiaoDoItemEncerrado("  Saraiva  ", "Uberlândia"), "Saraiva · Uberlândia");
  // Sem bairro gravado (ou a leitura do imóvel falhou): fica a cidade do pedido, como era.
  assert.equal(regiaoDoItemEncerrado(null, "Uberlândia"), "Uberlândia");
  assert.equal(regiaoDoItemEncerrado(undefined, "Uberlândia"), "Uberlândia");
  assert.equal(regiaoDoItemEncerrado("", "Uberlândia"), "Uberlândia");
});

test("E1148: a identificação é a mesma dos outros itens da lista — título do anúncio e código VN (E1108)", () => {
  assert.equal(identificacaoDoImovel("Casa das Acácias", "ab12cd34-0000-0000-0000-000000000000"), "Casa das Acácias · VN-AB12CD");
  // Sem o título (a leitura falhou), o item não fica vazio: sai o código VN.
  assert.equal(identificacaoDoImovel(null, "ab12cd34-0000-0000-0000-000000000000"), "VN-AB12CD");
});

test("E1148: a leitura traz o imóvel de cada item encerrado — e só o título e o bairro dele", () => {
  // A designação passa a dizer de que imóvel é o pedido.
  assert.match(pagina, /\.from\("vistoria_designacoes"\)\.select\("[^"]*vistoria_pedidos\(property_id, cidade, porte\)"\)/);
  // Os imóveis dos itens encerrados entram na mesma leitura dos títulos que já existia.
  assert.match(pagina, /const idsDosImoveis = \[\.\.\.new Set\(\[\.\.\.lista\.map\(\(p\) => p\.property_id\), \.\.\.foraDaMinhaFila\.flatMap\(\(d\) => \(d\.vistoria_pedidos \? \[d\.vistoria_pedidos\.property_id\] : \[\]\)\)\]\)\];/);
  assert.match(pagina, /\.from\("properties"\)\.select\("id, title, address"\)\.in\("id", idsDosImoveis\)/);
  assert.equal((pagina.match(/\.from\("properties"\)/g) ?? []).length, 1, "uma leitura só de imóveis");
  // A lista nunca pede a morada (rua, número, complemento): nem a coluna exata, nem o rascunho do cadastro.
  assert.doesNotMatch(pagina, /exact_address|draft_data|enderecoDaVisita|localDoPedido/, "a lista do avaliador não lê a morada");
});

test("E1148: o item encerrado mostra o imóvel (título, código VN, bairro) — sem morada e sem ligação", () => {
  assert.ok(item.length > 100, "achei o item");
  assert.match(item, /data-pedido=\{d\.pedido_id\}/);
  // O título e o código VN, pelo mesmo componente dos outros itens.
  assert.match(item, /\{d\.vistoria_pedidos && <IdentificacaoDoImovel texto=\{identificacaoDoImovel\(tituloDoImovel\.get\(d\.vistoria_pedidos\.property_id\), d\.vistoria_pedidos\.property_id\)\} \/>\}/);
  // O bairro junto da cidade, pela função da regra.
  assert.match(item, /regiaoDoItemEncerrado\(bairroDoImovel\.get\(d\.vistoria_pedidos\.property_id\), d\.vistoria_pedidos\.cidade\)/);
  // O que já lá estava continua: o rótulo do que aconteceu, o porte e a data.
  assert.match(item, /d\.proposta_descartada_em \? ROTULO_PROPOSTA_DESCARTADA : d\.proposta_expirada_em \? ROTULO_PROPOSTA_EXPIRADA : \(ROTULO_RESPOSTA\[d\.resposta \?\? ""\] \?\? d\.resposta\)/);
  assert.match(item, /ROTULO_PORTE\[d\.vistoria_pedidos\.porte\]/);
  assert.match(item, /dataBRT\(/);
  // Sem ligação: nem para a tela do pedido (que já não abre), nem para a página pública do anúncio.
  assert.doesNotMatch(item, /<Link|<a |href=|\/imoveis\//, "o item encerrado não tem ligação");
});
