/*
  Auditoria de erros e estados vazios — achado nº 43: em Solicitações (manutenção), uma leitura que falhava virava
  "Nenhuma solicitação ainda" e, sem os contratos, sumia o botão de pedir manutenção. Agora minhasSolicitacoes LANÇA e a
  tela mostra "Não foi possível carregar as solicitações agora" com "Tentar de novo".
  Roda: node --test src/lib/data/achado43-manutencao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("achado 43: minhasSolicitacoes lança quando as ordens ou os contratos não carregam", () => {
  const src = ler("./manutencao-actions.ts");
  const fn = src.slice(src.indexOf("export async function minhasSolicitacoes"), src.indexOf("const COLUNAS_ORDEM_ANTIGAS"));
  // A colunas novas caem nas antigas (migração 0210 ausente); só a falha das duas lança.
  assert.match(fn, /const leitura = nova\.error \? await consulta\(COLUNAS_ORDEM_ANTIGAS\) : nova;\n[\s\S]*?if \(leitura\.error\) throw new Error/);
  assert.match(fn, /if \(erroContratos\) throw new Error/);
  // A tela trata a falha com aviso e "Tentar de novo".
  const tela = ler("../../app/(dashboard)/dashboard/solicitacoes/page.tsx");
  assert.match(tela, /\.catch\(\(\) => vivo && setFalhou\(true\)\)/);
  assert.match(tela, /Não foi possível carregar as solicitações agora\.[\s\S]*?Tentar de novo/);
});
