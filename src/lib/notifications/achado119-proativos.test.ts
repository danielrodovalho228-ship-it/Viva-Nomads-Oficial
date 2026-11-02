/*
  Frente 1, rodada 2 — achado 119 (ALTA): o despacho dos e-mails proativos e o resumo semanal liam sem conferir o erro.
   - perfil não lido → a fila inteira descartada como "desligado" (avisos perdidos de quem quer recebê-los);
   - imóveis/pedidos/buscas/compatibilidade não lidos → itens descartados como "indisponível";
   - envios recentes não lidos → o teto de e-mails era ignorado (e-mails além do limite);
   - resumo: e-mails já enviados não lidos → reenvio do que já saiu.
  Agora as leituras LANÇAM: o despacho devolve "vazio" e o resumo "falhou" — nada é descartado nem reenviado; a
  próxima rodada tenta de novo. As chaves AUTOMACOES_ATIVO e RESUMO_SEMANAL_ATIVO não mudam.
  Roda: node --test src/lib/notifications/achado119-proativos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const pro = ler("./proativos-servidor.ts");
const res = ler("./resumo-semanal-servidor.ts");

test("despacho: as leituras lançam antes de qualquer descarte; o perfil não lido nunca vira 'desligado'", () => {
  assert.equal(pro.match(/throw new Error\(MSG_PROATIVOS_SEM_LEITURA\)/g)?.length, 7);
  const desp = pro.slice(pro.indexOf("export async function despacharProativos"));
  assert.ok(desp.indexOf("if (erroPerfil) throw") < desp.indexOf('await descartar(admin, pendentes.map((x) => x.id), "desligado")'));
  assert.match(desp, /\} catch \(e\) \{[\s\S]{0,120}return "vazio";/);
});

test("resumo semanal: perfil, enviados e favoritos lançam (→ 'falhou'), nunca reenviam", () => {
  for (const v of ["erroPerfil", "erroSaidos", "erroFavs"]) assert.match(res, new RegExp(`if \\(${v}\\) throw new Error\\(`), v);
  assert.match(res, /\} catch \(e\) \{\s*console\.error\("\[resumo-semanal\] pessoa:"[\s\S]{0,80}return "falhou";/);
});
