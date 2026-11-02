/*
  Estados vazios — Conta › Perfil, redes sociais privadas (63-B): a leitura que falha não vira campos vazios.
  Antes, minhasRedes ignorava o erro e devolvia as três redes vazias; se a pessoa preenchesse uma e salvasse, o upsert
  gravava as outras como null — apagando as redes já salvas. Agora a leitura lança e a tela mostra o aviso, sem formulário.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("minhasRedes lança quando a leitura falha", () => {
  const src = ler("../linkedin/actions.ts");
  const i = src.indexOf("export async function minhasRedes(");
  const f = src.slice(i, src.indexOf("\n}\n", i));
  assert.match(f, /const \{ data, error \} = await s\.supabase\.from\("perfil_redes"\)/);
  assert.match(f, /if \(error\) throw new Error\(/);
});

test("salvar continua gravando as três redes (por isso a leitura não pode cair para vazio)", () => {
  const src = ler("../linkedin/actions.ts");
  assert.match(src, /for \(const rede of \["instagram", "facebook", "tiktok"\] as const\)/);
});

test("a tela mostra o aviso de falha em vez do formulário", () => {
  const tela = ler("../../components/account/redes-privadas.tsx");
  assert.match(tela, /\.catch\(\(\) => vivo && setFalhou\(true\)\)/);
  assert.match(tela, /if \(REDES_USUARIO_ATIVO && falhou && !redes\)/);
  assert.match(tela, /data-testid="redes-falhou"/);
});
