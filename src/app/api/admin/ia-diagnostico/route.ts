import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";
import { lerDocumento, lerMatricula } from "@/lib/documento/conferidor";
import { hojeBR } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MIMES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Diagnóstico da leitura por IA (prompt 25) — SÓ ADMIN, com um arquivo FICTÍCIO (a matrícula de tests/fixtures).
 * Roda a MESMA leitura do cadastro (documento ou matrícula) com a chave de produção e devolve o que aconteceu: ok,
 * status, tipo e a mensagem exata do erro da API (até 300 caracteres), e só os campos não pessoais lidos (unidade,
 * áreas, vaga, legível). Nada é gravado além da linha em ia_chamadas (sem dado pessoal).
 */
export async function POST(request: Request) {
  const sessao = await createClient();
  if (!sessao) return NextResponse.json({ erro: "Só admin." }, { status: 403 });
  const {
    data: { user },
  } = await sessao.auth.getUser();
  if (!user || !(await ehAdmin(sessao, user.id))) return NextResponse.json({ erro: "Só admin." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  const tipo = form?.get("tipo") === "documento" ? "documento" : "matricula";
  if (!(arquivo instanceof File) || !MIMES.has(arquivo.type) || arquivo.size === 0 || arquivo.size > MAX_BYTES) {
    return NextResponse.json({ erro: "Envie um PDF, JPG ou PNG de até 10 MB." }, { status: 400 });
  }
  const doc = { bytes: new Uint8Array(await arquivo.arrayBuffer()), mime: arquivo.type };
  const endereco = { rua: null, numero: null, bairro: null, cidade: null, cep: null };
  const hoje = hojeBR();

  if (tipo === "documento") {
    const r = await lerDocumento(doc, { nomeConta: null, endereco, duplicado: 0, hoje });
    return NextResponse.json({
      tipo,
      conferidor: r.conferidor,
      modelo: r.modelo,
      ok: !!r.leitura,
      falha: r.falha ?? null,
      lido: r.leitura ? { tipo: r.leitura.tipo, legivel: r.leitura.legivel, completo: r.leitura.completo } : null,
    });
  }
  const r = await lerMatricula(doc, { perfil: { nome: null, cpf: null }, endereco, hoje });
  return NextResponse.json({
    tipo,
    conferidor: r.conferidor,
    modelo: r.modelo,
    ok: !!r.leitura,
    falha: r.falha ?? null,
    lido: r.leitura
      ? { unidade: r.leitura.unidade, areaPrivativa: r.leitura.areaPrivativa, areaTotal: r.leitura.areaTotal, vaga: r.leitura.vaga, legivel: r.leitura.legivel }
      : null,
  });
}
