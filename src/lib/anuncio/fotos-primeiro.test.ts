/*
  Ordem 04e2fe5e (parte 1) — cadastro "fotos primeiro". Confere, no código da
  tela, que o wizard abre pelas fotos, que a qualificação não é mais a 1ª tela
  (só barra a publicação) e que o uploader trata as fotos.
  Roda: node --test src/lib/anuncio/fotos-primeiro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ler = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");
const dirCadastro = join(process.cwd(), "src/app/(dashboard)/dashboard/imoveis/novo");
const lerCadastro = () => readdirSync(dirCadastro).filter((f) => f.endsWith(".tsx")).sort().map((f) => readFileSync(join(dirCadastro, f), "utf8")).join("\n");
// Cadastro em 5 etapas (prompt 10): a tela é a página + os componentes de cada etapa.
const pagina = lerCadastro();
const uploader = ler("components/photo-uploader.tsx");

test("o cadastro abre pela primeira etapa da ordem (Onde fica, prompt 10)", () => {
  assert.match(pagina, /useState<number>\(ORDEM_ETAPAS\[0\]\)/);
});

test("a qualificação não é mais um portão que esconde o cadastro", () => {
  assert.doesNotMatch(pagina, /Conclua a qualificação primeiro/);
  assert.match(pagina, /podePublicar = prontidao\.podePublicar && qualificado/);
  assert.match(pagina, /data-testid="aviso-qualificacao"/);
});

test("rascunho continua podendo ser salvo sem qualificação (só publicar é barrado)", () => {
  assert.match(pagina, /!asDraft && !editingId && !qualificado/);
});

test("o uploader trata a foto (EXIF/rotação, avisos, original) e aceita até 40", () => {
  // Prompt 20: o envio mora em lib/fotos/enviar.ts (um caminho só para galeria, cartão da IA e barra do celular).
  const envio = ler("lib/fotos/enviar.ts");
  assert.match(uploader, /enviarFotos\(/);
  assert.match(envio, /tratarFoto\(/);
  assert.match(envio, /avisosDaFoto\(/);
  assert.match(uploader, /Usar original/);
  assert.match(uploader, /MAX_FOTOS_POR_ANUNCIO/);
  assert.match(pagina, /max=\{MAX_FOTOS_POR_ANUNCIO\}/);
});
