/*
  E1077 (ORDEM-DUET-369, decisão do Daniel de 21/11/2026): ligar a avaliação do imóvel em âmbito de TESTE, só para as
  contas do piloto (vistoria_piloto). Com a VISTORIA_ATIVA desligada:
   - conta fora do piloto: tudo desligado e invisível, como hoje;
   - conta do piloto: a porta (vistoriaAtiva) abre — páginas, ações e o aviso do Início — e o rodízio só oferece
     avaliadores do piloto (nunca outro credenciado, nem a massa de teste de produção);
   - nenhuma conta entra no piloto pela migração (o Gerente regista as contas da prova; Rogério e esposa só depois dela);
   - nada diz "credenciado com o CNPJ da Viva" enquanto o CNPJ não existe; nenhum convite sai da plataforma.
  O lançamento PÚBLICO não muda: VISTORIA_ATIVA ligada continua a exigir tabela + ≥2 avaliadores + item 14.
  Roda: node --test src/lib/vistoria/e1077-avaliador-em-teste.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { modoDaChave, chaveAberta, filaNoAmbito } from "./ambito-da-chave.ts";
import { blocoDoDonoVisivel } from "./telas-exibicao.ts";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => readFileSync(p, "utf8");
/** O ajudante único tira os comentários do código; o `--` das migrações (SQL) sai à parte, antes. */
const semComentarios = (s: string) => fonteSemComentarios(s.replace(/--.*$/gm, ""));
const MIG = "supabase/migrations/0350_vistoria_piloto_e1077.sql";
const APLICAR = "supabase/producao/aplicar-0350.sql";

test("E1077: a chave tem quatro modos e só a conta do piloto abre o modo de teste", () => {
  assert.equal(modoDaChave({ global: true, laboratorio: false, noPiloto: false }), "global");
  assert.equal(modoDaChave({ global: false, laboratorio: true, noPiloto: false }), "laboratorio");
  assert.equal(modoDaChave({ global: false, laboratorio: false, noPiloto: true }), "piloto");
  assert.equal(modoDaChave({ global: false, laboratorio: false, noPiloto: false }), "desligada");
  assert.equal(chaveAberta("desligada"), false, "conta fora do piloto não vê nada");
  for (const m of ["global", "laboratorio", "piloto"] as const) assert.equal(chaveAberta(m), true, m);
});

test("E1077, opção (a) da ORDEM-DUET-375: o dono do piloto é conta de teste e, no piloto, o bloco fica ativo — fora dele, só conferência", () => {
  // No piloto a porta abre (chaveAberta("piloto")): o dono de teste deixa a só leitura.
  assert.equal(blocoDoDonoVisivel(chaveAberta(modoDaChave({ global: false, laboratorio: false, noPiloto: true })), true), "ativa");
  // Fora do piloto: o dono de teste só confere; o dono real não vê nada.
  const fora = chaveAberta(modoDaChave({ global: false, laboratorio: false, noPiloto: false }));
  assert.equal(blocoDoDonoVisivel(fora, true), "so_leitura_teste");
  assert.equal(blocoDoDonoVisivel(fora, false), null);
});

test("E1077: em modo piloto o rodízio só oferece avaliadores do piloto; nos outros modos a fila fica como está", () => {
  const fila = [{ userId: "rogerio" }, { userId: "esposa" }, { userId: "udi002-teste" }, { userId: "outro" }];
  const piloto = new Set(["rogerio", "esposa"]);
  assert.deepEqual(filaNoAmbito(fila, "piloto", piloto).map((a) => a.userId), ["rogerio", "esposa"]);
  assert.deepEqual(filaNoAmbito(fila, "piloto", new Set()), [], "piloto vazio: ninguém");
  assert.equal(filaNoAmbito(fila, "global", piloto).length, 4);
  assert.equal(filaNoAmbito(fila, "laboratorio", piloto).length, 4);
});

test("E1077: a porta vistoriaAtiva() lê o piloto da própria sessão; o rodízio aplica o âmbito", () => {
  const chave = ler("src/lib/vistoria/chave.ts");
  assert.match(chave, /rpc\("vistoria_no_piloto"\)/);
  assert.match(chave, /return chaveAberta\(await modoDaChaveAtual\(\)\);/);
  const servidor = ler("src/lib/vistoria/servidor.ts");
  assert.match(servidor, /filaNoAmbito\(/);
  assert.match(servidor, /from\("vistoria_piloto"\)\.select\("user_id"\)/);
});

test("E1077: a migração cria só a tabela e a função — nenhuma conta entra no piloto por ela", () => {
  for (const f of [MIG, APLICAR]) {
    assert.ok(existsSync(f), f);
    const s = semComentarios(ler(f));
    assert.match(s, /create table if not exists public\.vistoria_piloto/);
    assert.match(s, /create or replace function public\.vistoria_no_piloto\(\)/);
    assert.match(s, /where p\.user_id = auth\.uid\(\)/);
    assert.match(s, /revoke all on public\.vistoria_piloto from public, anon, authenticated;/);
    assert.doesNotMatch(s, /insert into public\.vistoria_piloto/, "as contas entram depois da prova do Gerente, não pela migração");
    assert.doesNotMatch(s, /avaliadores_credenciamento|VISTORIA_ATIVA/, "a migração não mexe no credenciamento nem na chave");
  }
  assert.match(ler(APLICAR), /'20261121000350', '0350_vistoria_piloto_e1077'/);
  assert.ok(existsSync("supabase/producao/rollback/0350_rollback.sql"));
});

test("E1077: nada na plataforma diz 'credenciado com o CNPJ da Viva' (o CNPJ ainda não existe)", () => {
  const arquivos: string[] = [];
  const andar = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) andar(p);
      else if (/\.(tsx?|md)$/.test(e.name) && !/\.test\.ts$/.test(e.name)) arquivos.push(p);
    }
  };
  andar("src");
  const culpados = arquivos.filter((f) => /CNPJ da Viva|credenciad[oa]s? (?:com|pelo) (?:o )?CNPJ/i.test(semComentarios(ler(f))));
  assert.deepEqual(culpados, []);
});

test("E1077: nenhum convite sai da plataforma ao entrar no piloto (a tabela não dispara e-mail nem aviso)", () => {
  for (const f of [MIG, APLICAR]) assert.doesNotMatch(semComentarios(ler(f)), /trigger|notify|net\.http|enviar/i);
  const chave = ler("src/lib/vistoria/ambito-da-chave.ts");
  assert.doesNotMatch(chave, /enviarEmail|notificar|sendMail|resend/i);
});
