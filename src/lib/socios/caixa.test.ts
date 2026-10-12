import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { caminhoDoAutor, mimeAceito, nomeSeguro, tipoDoMime, validarEnvio, LIMITE_BYTES } from "./caixa.ts";
import { textoDocx, textoXlsx } from "./office.ts";

const UID = "11111111-2222-3333-4444-555555555555";
const OUTRO = "99999999-2222-3333-4444-555555555555";

test("mimeAceito: type informado, extensão quando vem vazio/octet-stream e recusa o resto", () => {
  assert.equal(mimeAceito("audio/mp4", "a.m4a"), "audio/mp4");
  assert.equal(mimeAceito("", "Gravação.M4A"), "audio/mp4");
  assert.equal(mimeAceito("application/octet-stream", "nota.opus"), "audio/ogg");
  assert.equal(mimeAceito("audio/webm;codecs=opus", "x"), "audio/webm");
  assert.equal(mimeAceito("image/png", "print.png"), "image/png");
  assert.equal(mimeAceito("", "relatorio.pdf"), "application/pdf");
  assert.equal(mimeAceito("application/x-msdownload", "virus.exe"), null);
  assert.equal(mimeAceito("image/svg+xml", "a.svg"), null);
});

test("tipoDoMime", () => {
  assert.equal(tipoDoMime("audio/ogg"), "audio");
  assert.equal(tipoDoMime("image/heic"), "imagem");
  assert.equal(tipoDoMime("application/pdf"), "documento");
});

test("nomeSeguro tira acentos, barras e caracteres estranhos", () => {
  assert.equal(nomeSeguro("Áudio do Rogério (1).m4a"), "Audio-do-Rogerio-1-.m4a");
  assert.equal(nomeSeguro("../../etc/passwd"), "etc-passwd");
  assert.equal(nomeSeguro("###"), "arquivo");
});

test("caminhoDoAutor só aceita a pasta do próprio usuário, sem subir pasta", () => {
  assert.equal(caminhoDoAutor(`${UID}/123-a.m4a`, UID), true);
  assert.equal(caminhoDoAutor(`${OUTRO}/123-a.m4a`, UID), false);
  assert.equal(caminhoDoAutor(`${UID}/../x.m4a`, UID), false);
  assert.equal(caminhoDoAutor(`${UID}/sub/x.m4a`, UID), false);
  assert.equal(caminhoDoAutor(42, UID), false);
});

test("validarEnvio: texto puro, arquivo válido e casos negativos", () => {
  const t = validarEnvio({ texto: "  oi equipe  " }, UID);
  assert.ok(t.ok && t.dados.tipo === "texto" && t.dados.texto === "oi equipe");

  const a = validarEnvio({ path: `${UID}/1-audio.m4a`, nome: "audio.m4a", mime: "", tamanho: 1000 }, UID);
  assert.ok(a.ok && a.dados.tipo === "audio" && a.dados.mime === "audio/mp4" && a.dados.texto === null);

  assert.equal(validarEnvio({}, UID).ok, false);
  assert.equal(validarEnvio({ texto: "x".repeat(4001) }, UID).ok, false);
  assert.equal(validarEnvio({ path: `${OUTRO}/1-a.m4a`, nome: "a.m4a", mime: "audio/mp4", tamanho: 10 }, UID).ok, false);
  assert.equal(validarEnvio({ path: `${UID}/1-a.exe`, nome: "a.exe", mime: "application/x-msdownload", tamanho: 10 }, UID).ok, false);
  assert.equal(validarEnvio({ path: `${UID}/1-a.pdf`, nome: "a.pdf", mime: "application/pdf", tamanho: LIMITE_BYTES + 1 }, UID).ok, false);
});

/** Monta um .zip mínimo (deflate) para testar o leitor de Office. */
function zip(arquivos: Record<string, string>): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let off = 0;
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const dados = deflateRawSync(Buffer.from(conteudo, "utf8"));
    const n = Buffer.from(nome, "utf8");
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(8, 8); loc.writeUInt32LE(dados.length, 18);
    loc.writeUInt32LE(Buffer.byteLength(conteudo), 22); loc.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(8, 10); cen.writeUInt32LE(dados.length, 20);
    cen.writeUInt32LE(Buffer.byteLength(conteudo), 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(off, 42);
    locais.push(loc, n, dados);
    centrais.push(cen, n);
    off += 30 + n.length + dados.length;
  }
  const dir = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(Object.keys(arquivos).length, 8);
  fim.writeUInt16LE(Object.keys(arquivos).length, 10); fim.writeUInt32LE(dir.length, 12); fim.writeUInt32LE(off, 16);
  return Buffer.concat([...locais, dir, fim]);
}

test("textoDocx lê parágrafos e desescapa", () => {
  const xml = '<w:document><w:body><w:p><w:r><w:t>Olá &amp; bem-vindo</w:t></w:r></w:p><w:p><w:r><w:t>Linha 2</w:t></w:r></w:p></w:body></w:document>';
  assert.equal(textoDocx(zip({ "word/document.xml": xml })), "Olá & bem-vindo\nLinha 2");
});

test("textoXlsx junta strings compartilhadas e números", () => {
  const shared = "<sst><si><t>Cidade</t></si><si><t>Uberlândia</t></si></sst>";
  const sheet = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>12</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c></row></sheetData></worksheet>';
  assert.equal(textoXlsx(zip({ "xl/sharedStrings.xml": shared, "xl/worksheets/sheet1.xml": sheet })), "# sheet1\nCidade\t12\nUberlândia");
});

test("leitor de Office recusa arquivo que não é zip", () => {
  assert.throws(() => textoDocx(Buffer.from("não sou zip")));
});
