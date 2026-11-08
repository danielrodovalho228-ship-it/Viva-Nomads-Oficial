import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const form = ler("src/components/avaliacao-form.tsx");
const acoes = ler("src/lib/data/contratos-actions.ts");

// E719 (QA, prova do E679): depois das DUAS avaliações do contrato publicadas, o cartão do contrato seguiu no estado
// anterior (botão "Avaliar…" ou "aguardando a outra parte"). O cartão só sabia da janela de datas e do envio da visita
// atual; agora lê a avaliação que a pessoa já enviou (e se já foi publicada) e mostra o estado verdadeiro.
test("os dois carregadores de contrato trazem o estado da avaliação da própria pessoa", () => {
  assert.equal((acoes.match(/minhaAvaliacao:/g) ?? []).length >= 4, true, "tipos e retornos de contratos e locações");
  assert.match(acoes, /from\("avaliacoes"\)[\s\S]{0,200}\.eq\("autor_id", userId\)/);
});

test("o formulário mostra 'publicada' quando a avaliação já saiu, e 'enviada' sem oferecer o botão de novo", () => {
  assert.match(form, /estadoAvaliacao\?: string \| null/);
  assert.match(form, /data-testid="avaliacao-publicada"/);
  assert.match(form, /euEnviei=\{enviado \|\| !!estadoAvaliacao\}/);
});

test("os cartões de contrato e de locação passam o estado ao formulário", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/contratos/contratos-client.tsx"), /estadoAvaliacao=\{contrato\.minhaAvaliacao\}/);
  assert.match(ler("src/app/(dashboard)/dashboard/locacoes/locacoes-client.tsx"), /estadoAvaliacao=\{l\.minhaAvaliacao\}/);
});
