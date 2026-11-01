import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

// Vigia 01/11: nas telas, "morador"; "inquilino" só em contexto jurídico/contrato (admin/contratos e documentos de contrato).
test("admin fala 'morador' nas telas que não são de contrato", () => {
  const telas = [
    "app/(dashboard)/admin/usuarios/page.tsx",
    "app/(dashboard)/admin/parceiros/page.tsx",
    "app/(dashboard)/admin/atendimento/[id]/chamado-client.tsx",
    "app/(dashboard)/admin/dados-de-teste/nova-jornada.tsx",
    "app/(dashboard)/admin/dados-de-teste/semear-carteira.tsx",
    "app/(dashboard)/admin/dados-de-teste/page.tsx",
    "app/(dashboard)/admin/dados-de-teste/encerrar-jornadas.tsx",
    "app/(dashboard)/admin/pedidos/admin-pedidos-client.tsx",
    "components/admin/chave-sms.tsx",
  ];
  for (const t of telas) {
    // Texto visível: rótulos entre aspas ou entre tags. Nomes de variáveis/props (inquilinos, r.inquilino) e o valor de URL
    // "inquilino" (filtro antigo, mantido) não são texto.
    const visivel = ler(t)
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n")
      .match(/(>[^<{\n]*\b[Ii]nquilinos?\b[^<{\n]*<|"[^"\n]*\b[Ii]nquilinos?\b[^"\n]*"|`[^`\n]*\b[Ii]nquilinos?\b[^`\n]*`)/g) ?? [];
    const textos = visivel.filter((v) => !/^"[a-z0-9-]*inquilinos?[a-z0-9-]*"$|value="inquilino"|padrao\(inquilinos/.test(v));
    assert.deepEqual(textos, [], t);
  }
  assert.match(ler("lib/admin/usuarios-lista.ts"), /f\.papel === "tenant" \? "Moradores"/);
  // Contrato segue com o termo jurídico.
  assert.match(ler("app/(dashboard)/admin/contratos/[id]/page.tsx"), /Inquilino: <strong>/);
});
