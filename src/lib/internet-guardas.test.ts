/*
  Guardas do Prompt 57 (internet medida no imóvel).
  Roda: node --test src/lib/internet-guardas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { INTERNET_TIERS } from "./internet.ts";
import { CONFIG_MOTOR } from "./internet-motor.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
function arquivos(dir: string): string[] {
  const raiz = new URL(`../../${dir}`, import.meta.url).pathname;
  return readdirSync(raiz).flatMap((n) => {
    const p = join(raiz, n);
    return statSync(p).isDirectory() ? arquivos(`${dir}/${n}`) : /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [`${dir}/${n}`] : [];
  });
}

test("GUARDA: nenhuma frase de capacidade no anúncio sem medição (categorias informadas e página do imóvel)", () => {
  for (const t of INTERNET_TIERS) {
    for (const f of [t.anuncio, t.anuncioFibra]) {
      assert.doesNotMatch(f, /videochamad|aguenta|pesad|excelente|vários dispositivos/i, f);
      assert.match(f, /informada pelo proprietário \(não medida\)/, f);
    }
  }
  // A frase "Boa para videochamadas" só existe na constante e sai pela regra (textoInternet/boaParaVideochamada).
  for (const p of arquivos("src/components/property")) {
    // Texto entre aspas (o campo `.videochamada` do resultado da regra pode aparecer; a frase escrita à mão, não).
    assert.doesNotMatch(ler(p), /["'`>][\p{L} ,.·-]*videochamad[\p{L} ,.·-]*["'`<]/iu, `${p}: frase de capacidade escrita à mão`);
  }
  const medida = ler("src/lib/internet-medida.ts");
  assert.match(medida, /videochamada: boaParaVideochamada\(medida\) \? TEXTO_VIDEOCHAMADA : null/);
  assert.match(medida, /tipo: "informada", texto: [^\n]*videochamada: null/);
});

test("GUARDA: nenhuma chamada ao M-Lab/NDT (a política deles publica o IP de quem testa)", () => {
  for (const p of [...arquivos("src"), "package.json"]) {
    assert.doesNotMatch(ler(p), /measurementlab|m-lab\.|ndt7|@m-lab\//i, p);
  }
});

test("GUARDA: o motor não envia resultado a terceiros (logAimApiUrl e logMeasurementApiUrl nulos; sem packetLoss/TURN)", () => {
  assert.equal(CONFIG_MOTOR.logAimApiUrl, null);
  assert.equal(CONFIG_MOTOR.logMeasurementApiUrl, null);
  assert.equal(CONFIG_MOTOR.includeCredentials, false);
  assert.equal(CONFIG_MOTOR.autoStart, false);
  const tipos = new Set(CONFIG_MOTOR.measurements.map((m) => m.type));
  assert.deepEqual([...tipos].sort(), ["download", "latency", "upload"]);
  const pkg = JSON.parse(ler("package.json")) as { dependencies: Record<string, string> };
  assert.match(pkg.dependencies["@cloudflare/speedtest"], /^\d+\.\d+\.\d+$/, "versão fixa, sem ^ ou ~");
});

test("GUARDA: a posição do aparelho nunca é gravada (só a distância) e a escrita é só pelo servidor", () => {
  const srv = ler("src/lib/internet-medida-servidor.ts");
  const insert = srv.slice(srv.indexOf('.from("internet_medicoes").insert('), srv.indexOf("if (error) return { ok: false, erro: \"Não deu para salvar"));
  assert.doesNotMatch(insert, /\blat\b|\blng\b|aparelho/);
  assert.match(insert, /distancia_m: local\.distanciaM/);
  assert.match(srv, /createAdminClient\(\)/);
  // A página do imóvel é ISR: a medição validada do dono revalida a página na hora.
  assert.match(srv, /if \(papel === "dono" && local\.validada\) revalidatePath\(`\/imoveis\/\$\{imovelId\}`\)/);
  const mig = readdirSync(new URL("../../supabase/migrations", import.meta.url)).find((n) => /_internet_medida\.sql$/.test(n))!;
  const sql = ler(`supabase/migrations/${mig}`);
  assert.doesNotMatch(sql, /lat(itude)?\s+double|lng\s+double|longitude/i, "a tabela não tem coluna de coordenada");
  assert.match(sql, /revoke insert, update, delete, truncate on public\.internet_medicoes from anon, authenticated/);
});
