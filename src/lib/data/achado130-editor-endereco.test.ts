/*
  Frente 1 (páginas) — achado 130 (baixa-média): o editor do anúncio lia o endereço exato (rua, número e
  complemento, coluna restrita) pela RPC property_private_details sem conferir o erro. Na falha, o editor abria com a
  rua VAZIA num anúncio que tem endereço: o dono via o campo em branco e achava que o endereço tinha sumido. Salvar
  não apagava (colunaEnderecoExato: vazio nunca apaga), mas a tela mentia. Agora a falha lança e a página cai no
  error.tsx ("Tente de novo"), como as demais da varredura.
  Roda: node --test src/lib/data/achado130-editor-endereco.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("editor: sem o endereço exato, não abre com a rua vazia", () => {
  const t = ler("src/app/(dashboard)/dashboard/imoveis/[id]/editar/page.tsx");
  assert.match(t, /const \{ data: priv, error: erroPriv \} = await supabase\.rpc\("property_private_details", \{ prop_id: id \}\);/);
  assert.match(t, /if \(erroPriv\) throw new Error\(/);
  assert.ok(t.indexOf("if (erroPriv) throw") < t.indexOf("enderecoExato = linha?.exact_address"), "confere antes de usar");
});

test("salvar com a rua vazia continua sem apagar o endereço gravado", () => {
  const a = ler("src/lib/data/actions.ts");
  assert.match(a, /function colunaEnderecoExato\(v: string \| undefined\): \{ exact_address\?: string \} \{[\s\S]*?return t \? \{ exact_address: t \} : \{\};/);
});
