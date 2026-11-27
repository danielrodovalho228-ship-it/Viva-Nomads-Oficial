/*
  E640 (c) — fotos de check-in/check-out (e o laudo em PDF) com proteção FORTE (aprovado pelo Daniel em 05/11/2026):
  só as duas partes logadas, link que expira, sem download, marca VISÍVEL com o nome de quem vê + a data.
  Texto honesto aprovado: "Fotos protegidas: as de entrada e saída são privadas entre você e o proprietário, sem download e
  com identificação de quem visualiza." — sem prometer bloquear print.
  Roda: node --test src/lib/protecao/e640c-protecao-forte.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { TEXTO_FOTOS_PROTEGIDAS, TTL_LINK_PROTEGIDO_S, assinarLink, escaparXml, linkProtegidoPath, marcaTexto, svgMarca, verificarLink } from "./visualizacao.ts";
import { marcarImagem, marcarPdf } from "./marca.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const SEGREDO = "segredo-de-teste-do-servidor";
const agora = new Date("2026-11-06T12:00:00Z");

test("texto honesto aprovado, sem promessa de bloquear print", () => {
  assert.equal(TEXTO_FOTOS_PROTEGIDAS, "Fotos protegidas: as de entrada e saída são privadas entre você e o proprietário, sem download e com identificação de quem visualiza.");
  assert.doesNotMatch(TEXTO_FOTOS_PROTEGIDAS, /print|embaralhad|imposs/i);
});

test("link assinado: vale para a mesma pessoa, no prazo, para o mesmo arquivo", () => {
  const t = assinarLink({ caminho: "c1/abc.jpg", uid: "u1" }, SEGREDO, agora);
  const v = verificarLink(t, SEGREDO, agora);
  assert.ok(v.ok);
  if (v.ok) {
    assert.equal(v.caminho, "c1/abc.jpg");
    assert.equal(v.uid, "u1");
  }
});

test("o link expira (TTL curto) e não vale um segundo antes de nascer", () => {
  assert.ok(TTL_LINK_PROTEGIDO_S <= 600);
  const t = assinarLink({ caminho: "c1/abc.jpg", uid: "u1" }, SEGREDO, agora);
  assert.equal(verificarLink(t, SEGREDO, new Date(agora.getTime() + (TTL_LINK_PROTEGIDO_S + 1) * 1000)).ok, false);
  assert.equal(verificarLink(t, SEGREDO, new Date(agora.getTime() + (TTL_LINK_PROTEGIDO_S - 5) * 1000)).ok, true);
});

test("link adulterado, de outro segredo ou malformado é recusado", () => {
  const t = assinarLink({ caminho: "c1/abc.jpg", uid: "u1" }, SEGREDO, agora);
  assert.equal(verificarLink(t, "outro-segredo", agora).ok, false);
  assert.equal(verificarLink(t.slice(0, -2) + "xx", SEGREDO, agora).ok, false);
  assert.equal(verificarLink("lixo", SEGREDO, agora).ok, false);
  assert.equal(verificarLink("", SEGREDO, agora).ok, false);
  const [corpo, sig] = t.split(".");
  const outro = Buffer.from(JSON.stringify({ c: "c2/outra.jpg", u: "u1", exp: 9999999999 })).toString("base64url");
  assert.equal(verificarLink(`${outro}.${sig}`, SEGREDO, agora).ok, false, "trocar o caminho invalida a assinatura");
  assert.ok(corpo.length > 0);
});

test("caminho com .. ou absoluto nunca é assinado", () => {
  assert.throws(() => assinarLink({ caminho: "../x.jpg", uid: "u1" }, SEGREDO, agora));
  assert.throws(() => assinarLink({ caminho: "/etc/passwd", uid: "u1" }, SEGREDO, agora));
});

test("a marca diz o nome de quem vê e a data (Brasília)", () => {
  assert.equal(marcaTexto("Ana Souza", agora), "Visto por Ana Souza em 06/11/2026");
  assert.match(marcaTexto("  ", agora), /Visto por conta logada em 06\/11\/2026/);
});

test("o SVG da marca escapa o nome (nada de injeção) e cobre a imagem inteira", () => {
  assert.equal(escaparXml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&apos;");
  const svg = svgMarca(800, 600, `Ana <script>alert(1)</script>`, agora);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /width="800"/);
  assert.ok((svg.match(/<text /g) ?? []).length >= 6, "marca repetida, não um canto só");
});

test("marcarImagem devolve uma imagem do mesmo formato, reduzida a resolução de tela, com a marca desenhada", async () => {
  const base = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 240, g: 240, b: 240 } } }).jpeg().toBuffer();
  const saida = await marcarImagem(new Uint8Array(base), "Ana Souza", agora);
  assert.ok(saida);
  const meta = await sharp(saida!.bytes).metadata();
  assert.equal(meta.format, "jpeg");
  assert.ok(Math.max(meta.width ?? 0, meta.height ?? 0) <= 1600);
  assert.equal(meta.exif, undefined);
  const crua = await sharp(await sharp(base).resize(1600).jpeg().toBuffer()).raw().toBuffer();
  const marcada = await sharp(saida!.bytes).raw().toBuffer();
  assert.notDeepEqual(Buffer.from(marcada).subarray(0, 4000), Buffer.from(crua).subarray(0, 4000), "a marca altera os pixels");
});

test("marcarImagem recusa arquivo que não é imagem", async () => {
  assert.equal(await marcarImagem(new Uint8Array([1, 2, 3, 4]), "Ana", agora), null);
});

test("marcarPdf devolve um PDF válido com a marca em todas as páginas", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 600]);
  doc.addPage([400, 600]);
  const bytes = await doc.save();
  const saida = await marcarPdf(new Uint8Array(bytes), "Ana Souza", agora);
  assert.ok(saida);
  const lido = await PDFDocument.load(saida!);
  assert.equal(lido.getPageCount(), 2);
  assert.ok(saida!.length > bytes.length, "a marca acrescenta conteúdo");
  assert.equal(await marcarPdf(new Uint8Array([1, 2, 3]), "Ana", agora), null);
});

test("o caminho do link é uma rota nossa, nunca a URL do armazenamento", () => {
  const p = linkProtegidoPath("TOKEN");
  assert.equal(p, "/api/protegido/conferencia?t=TOKEN");
  assert.doesNotMatch(p, /supabase|storage|signed/i);
});

test("a rota: exige login, confere o token, confere a parte pelo RLS e responde sem cache e sem download", () => {
  const r = ler("src/app/api/protegido/conferencia/route.ts");
  assert.match(r, /auth\.getUser\(\)/);
  assert.match(r, /verificarLink\(/);
  assert.match(r, /v\.uid !== user\.id/);
  assert.match(r, /conferencia_itens/);
  assert.match(r, /conferencia_conforto/);
  assert.match(r, /conferencia_laudos/);
  assert.match(r, /"Cache-Control": "private, no-store/);
  assert.match(r, /Content-Disposition": "inline"/);
  assert.match(r, /X-Content-Type-Options": "nosniff"/);
  assert.match(r, /marcarImagem\(/);
  assert.match(r, /marcarPdf\(/);
  assert.doesNotMatch(r, /attachment/);
});

test("a conferência serve a foto e o laudo pelo link protegido, não pela URL assinada do armazenamento", () => {
  const a = ler("src/lib/data/conferencia-actions.ts");
  assert.match(a, /linkProtegidoDe\(/);
  assert.doesNotMatch(a, /createSignedUrl\(input\.fotoPath/);
  assert.doesNotMatch(a, /const assinar = async \(path: string \| null\) =>\s*\n\s*path && admin \? \(\(await admin\.storage\.from\(BUCKET\)\.createSignedUrl/);
});

test("a tela da conferência: sem clique-direito nem arrastar, sem download, e diz o texto honesto", () => {
  const t = ler("src/components/contrato/conferencia-contrato.tsx");
  assert.match(t, /TEXTO_FOTOS_PROTEGIDAS/);
  assert.match(t, /onContextMenu=\{\(e\) => e\.preventDefault\(\)\}/);
  assert.match(t, /draggable=\{false\}/);
  assert.doesNotMatch(t, /\sdownload[=\s>]/);
});
