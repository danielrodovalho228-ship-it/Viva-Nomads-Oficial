/*
  Resíduo da varredura de páginas — achado 133 (baixo): o cartão "Push" do admin lia as contas de teste e as
  contagens de aparelhos sem conferir o erro. Na falha das contas de teste, aparelhos, entregas e falhas eram contados
  COM as contas de teste (o cartão diz "Contas de teste não entram"); na falha de uma contagem, a plataforma aparecia
  com 0 ("nenhum aparelho") em vez de "não li". Agora o número não lido é "—" (a regra do Início, valorContador),
  com o aviso no cartão; nada é gravado (o cartão só lê).
  Roda: node --test src/lib/notifications/achado133-cartao-push.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const t = readFileSync(new URL("../../components/admin/cartao-push.tsx", import.meta.url), "utf8");

test("contas de teste não lidas: nada é contado com elas; o cartão avisa", () => {
  assert.match(t, /const \{ data: teste, error: erroTeste \} = await admin\.from\("profiles"\)\.select\("id"\)\.eq\("is_teste", true\);/);
  assert.match(t, /data-testid="cartao-push-sem-leitura"/);
});

test("contagem que falha é '—', nunca 0", () => {
  assert.match(t, /return q\.then\(\(x\) => \(x\.error \? null : \(x\.count \?\? 0\)\)\);/);
  assert.match(t, /import \{ valorContador \} from "@\/lib\/painel\/sem-leitura";/);
  assert.match(t, /\{valorContador\(total\)\}/);
  assert.doesNotMatch(t, /\{r\.totalAparelhos\}/);
});
