import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, DIA } from "@/lib/limites";
import { verificarLink } from "@/lib/protecao/visualizacao";
import { segredoProtecao } from "@/lib/protecao/servidor";
import { marcarImagem, marcarPdf } from "@/lib/protecao/marca";

const BUCKET = "conferencia";

/**
 * E640 (c) — foto de check-in/check-out e laudo, com proteção FORTE (aprovado pelo Daniel em 05/11/2026):
 *  • só pessoa logada, e só a que o link nomeia; o link expira em minutos;
 *  • a parte do contrato é conferida de novo pelo RLS (o arquivo tem que estar numa conferência que a pessoa enxerga);
 *  • sem download: resposta inline, sem cache, sem o arquivo original — sai com a marca visível (nome de quem vê + data).
 * Não promete bloquear print.
 */
const CABECALHOS_BASE = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Disposition": "inline",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const;

const negar = (status: number, erro: string) => NextResponse.json({ error: erro }, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const segredo = segredoProtecao();
  if (!supabase || !admin || !segredo) return negar(503, "Indisponível.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return negar(401, "Entre na sua conta para ver.");

  const v = verificarLink(new URL(request.url).searchParams.get("t") ?? "", segredo);
  if (!v.ok) return negar(410, "Este link expirou. Atualize a página.");
  if (v.uid !== user.id) return negar(403, "Este link não é seu.");
  if (!(await consumirLimite(`protegido:${user.id}`, 600, DIA))) return negar(429, "Muitas visualizações hoje.");

  // A parte do contrato, pelo RLS (cliente da própria pessoa): o arquivo precisa estar numa conferência que ela enxerga.
  const [item, conforto, laudo] = await Promise.all([
    supabase.from("conferencia_itens").select("id").eq("foto_path", v.caminho).limit(1),
    supabase.from("conferencia_conforto").select("conferencia_id").eq("foto_path", v.caminho).limit(1),
    supabase.from("conferencia_laudos").select("conferencia_id").eq("path", v.caminho).limit(1),
  ]);
  const autorizada = [item, conforto, laudo].some((r) => !r.error && (r.data ?? []).length > 0);
  if (!autorizada) return negar(404, "Arquivo não encontrado.");

  const { data: arquivo, error } = await admin.storage.from(BUCKET).download(v.caminho);
  if (error || !arquivo) return negar(404, "Arquivo não encontrado.");
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const { data: perfil } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const nome = ((perfil as { full_name?: string | null } | null)?.full_name ?? "").trim();

  if (/\.pdf$/i.test(v.caminho)) {
    const pdf = await marcarPdf(bytes, nome);
    if (!pdf) return negar(415, "Não foi possível abrir este arquivo.");
    return new NextResponse(Buffer.from(pdf), { headers: { ...CABECALHOS_BASE, "Content-Type": "application/pdf" } });
  }
  const img = await marcarImagem(bytes, nome);
  if (!img) return negar(415, "Não foi possível abrir este arquivo.");
  return new NextResponse(Buffer.from(img.bytes), { headers: { ...CABECALHOS_BASE, "Content-Type": img.tipo } });
}
