/*
  E790 (regra E445): contato nunca é revelado, em nenhuma fase — correção na ORIGEM (servidor e banco), não só no texto.
  Roda: node --test src/lib/parceiros/e790-contato-nunca-revelado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";

const raiz = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, raiz), "utf8");
const sem = (s: string) => s.replace(/^\s*(--|\/\/).*$/gm, "");

test("pedido de parceiro: o servidor não lê nem devolve o contato da outra parte (nenhum status)", () => {
  const a = sem(ler("src/lib/parceiros/pedido-actions.ts"));
  assert.doesNotMatch(a, /contatoDaOutraParte|contatoNoPedido|ContatoDoPedido/);
  assert.doesNotMatch(a, /\.select\("email, phone"\)/);
  assert.doesNotMatch(a, /from\("parceiros"\)\.select\("telefone"\)/);
  const tipos = sem(ler("src/lib/parceiros/pedido.ts"));
  assert.doesNotMatch(tipos, /export function contatoNoPedido|export interface ContatoDoPedido/);
});

test("fotógrafos: a regra que liberava o contato do dono depois do aceite não existe mais", () => {
  assert.doesNotMatch(sem(ler("src/lib/fotografos/regras.ts")), /contatoLiberado/);
});

test("varredura: nenhuma tela do painel/pública mostra tel: ou mailto: com dado da outra parte", () => {
  const achados: string[] = [];
  const andar = (dir: string) => {
    for (const nome of readdirSync(new URL(dir, raiz))) {
      const caminho = `${dir}${nome}`;
      if (statSync(new URL(caminho, raiz)).isDirectory()) andar(`${caminho}/`);
      else if (/\.tsx$/.test(nome) && !/\.test\./.test(nome)) {
        const s = ler(caminho);
        // tel:/mailto: só com constante da Viva (WhatsApp/telefone/e-mail da equipe), nunca com campo vindo do banco.
        for (const m of s.matchAll(/href=\{`(?:tel|mailto):[^$`]*\$\{([^}]+)\}/g)) if (!/VIVA|SUPORTE|EQUIPE|CONTATO_VIVA|EMAIL_|TELEFONE_/i.test(m[1])) achados.push(`${caminho}: ${m[1]}`);
      }
    }
  };
  andar("src/app/");
  andar("src/components/");
  assert.deepEqual(achados, []);
});

test("banco (0339): o contato do responsável local só vai ao dono e ao admin; o morador aceito recebe só o endereço", () => {
  for (const f of ["supabase/migrations/0339_contato_responsavel_so_dono_e790.sql", "supabase/producao/aplicar-0339.sql"]) {
    const sql = sem(ler(f));
    for (const col of ["responsavel_local_nome", "responsavel_local_telefone", "responsavel_local_email"])
      assert.match(sql, new RegExp(`case when p\\.owner_id = auth\\.uid\\(\\) or public\\.is_admin\\(\\) then p\\.${col} else null end`), `${f}: ${col}`);
    assert.match(sql, /select\s+p\.exact_address,/);
    assert.match(sql, /l\.status = 'accepted'/);
    assert.match(sql, /revoke all on function public\.property_private_details\(uuid\) from public, anon;/);
  }
  assert.match(ler("supabase/producao/aplicar-0339.sql"), /'20261111000339', '0339_contato_responsavel_so_dono_e790'/);
  assert.match(ler("supabase/producao/rollback/0339_rollback.sql"), /version = '20261111000339'/);
});
