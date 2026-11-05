/*
  Varredura de erros (rodada 24): falha de leitura não vira "nada pendente", "nenhuma estadia" nem "não enviado".
  Achado 128: /socios — a falha ao ler as aprovações pendentes virava "Nada pendente agora" (o Daniel deixaria de ver o
    que espera a aprovação dele). Agora a página não cai, mas diz que não conseguiu ler.
  Achado 129: calendário do anúncio — a falha ao conferir o dono do imóvel virava "nenhuma estadia", mesmo com `exigir`
    (dias ocupados sumiam). Agora lança e o calendário avisa (o aviso do Achado 20).
  Achado 130: documentos do morador — a falha ao ler a candidatura virava "sem permissão"/lista vazia ("ainda não
    enviou" ao dono; tudo pendente ao morador). Agora lança (a tela avisa); o link do documento diz "não foi possível
    abrir agora", nunca "documento não enviado".
  Roda: node --test src/lib/data/achado128-130-leituras.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("Achado 128: /socios distingue falha de 'nada pendente'", () => {
  const s = ler("lib/socios/pendencias-servidor.ts");
  assert.match(s, /export async function carregarPendenciasSocios\(\): Promise<Pendencia\[\] \| null>/);
  assert.match(s, /if \(error\) return null;/);
  const c = ler("components/socios/socios.tsx");
  assert.match(c, /pendencias === null \?/);
  assert.match(c, /data-testid="pendencias-erro"/);
  assert.match(c, /Não foi possível ler as pendências agora/);
});

test("Achado 129: o calendário lança na falha ao conferir o dono (com exigir)", () => {
  const s = ler("lib/data/estadias-calendario.ts");
  assert.match(s, /const \{ data: imovel, error: erroImovel \} = await supabase/);
  assert.match(s, /if \(erroImovel && opcoes\.exigir\) throw new Error/);
});

test("Achado 130: documentos do morador lançam na falha da candidatura; o link não diz 'não enviado' na falha", () => {
  const s = ler("lib/data/documentos-inquilino-actions.ts");
  assert.match(s, /const \{ data: lead, error \} = await admin\.from\("leads"\)/);
  assert.match(s, /if \(error\) throw new Error\("Não foi possível ler a candidatura agora\."\);/);
  const link = s.slice(s.indexOf("export async function linkDocInquilino"));
  assert.match(link, /const ctx = await parteDaCandidatura\(leadId\)\.catch\(\(\) => "falhou" as const\);/);
  assert.match(link, /if \(ctx === "falhou"\) return \{ ok: false, error: "Não foi possível abrir agora\." \};/);
  assert.match(link, /const \{ data: doc, error: erroDoc \} = await ctx\.admin/);
  assert.match(link, /if \(erroDoc\) return \{ ok: false, error: "Não foi possível abrir agora\." \};/);
});
