/*
  Varredura de erros (rodada 30): a tela Conta › Privacidade não mostra os valores PADRÃO como se fossem as escolhas da pessoa.
  Achado 143: se a leitura falhava, o servidor (getUser com erro) e o cliente (.catch) devolviam os padrões — quem tinha
    desligado "Aparecer na busca" via o interruptor LIGADO, e o próximo toque salvava por cima da escolha real. Agora a
    falha do servidor lança, e o cliente mostra "Não foi possível carregar suas permissões agora" com "Tentar de novo",
    sem interruptores. Sem sessão (AuthSessionMissingError) segue o padrão: não é falha.
  Roda: node --test src/lib/conta/achado143-privacidade-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("servidor: a falha do getUser (que não seja 'sem sessão') lança em vez de devolver os padrões", () => {
  const a = ler("src/lib/data/privacidade-actions.ts");
  const fn = a.slice(a.indexOf("export async function getPrivacidade"), a.indexOf("export async function setPrivacidade"));
  assert.match(fn, /data: \{ user \},\s*\n\s*error,\s*\n\s*\} = await supabase\.auth\.getUser\(\);/);
  assert.match(fn, /if \(error && error\.name !== "AuthSessionMissingError"\) throw new Error\(MSG_PRIVACIDADE_NAO_CARREGOU\);/);
});

test("cliente: o .catch não grava os padrões; mostra a falha com 'Tentar de novo' e sem interruptores", () => {
  const t = ler("src/components/account/tela-privacidade.tsx");
  assert.doesNotMatch(t, /\.catch\(\(\) => vivo && setP\(\{ mostrar_perfil: true/);
  assert.match(t, /\.catch\(\(\) => vivo && setFalhou\(true\)\)/);
  assert.match(t, /data-testid="privacidade-falhou"/);
  assert.match(t, /data-testid="privacidade-tentar-de-novo"/);
  assert.match(t, /Não foi possível carregar suas permissões agora/);
  // com falha, nenhum interruptor é desenhado (nem o esqueleto de carregamento)
  assert.match(t, /\{falhou \? \(/);
});
