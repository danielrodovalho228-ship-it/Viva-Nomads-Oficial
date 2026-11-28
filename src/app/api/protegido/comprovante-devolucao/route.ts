import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { consumirLimite, DIA } from "@/lib/limites";
import { verificarLink } from "@/lib/protecao/visualizacao";
import { segredoProtecao } from "@/lib/protecao/servidor";
import { marcarImagem, marcarPdf } from "@/lib/protecao/marca";
import { podeLerComprovante } from "@/lib/caucao/devolucao-maquina";

/**
 * E1248 PR 1 — o comprovante da devolução da caução (ESPEC-E1248 v11, 2.7 e 9-A; ORDEM-1352). Fica no bucket privado da
 * conferência, mas a autorização é PRÓPRIA: a rota da conferência só entrega caminhos das tabelas dela, e a regra de
 * leitura de caucao_acertos deixa ler o responsável local do imóvel. Leem só o dono que enviou, o morador daquele
 * contrato e a equipe:
 *  • só pessoa logada, e só a que o link nomeia; o link expira em minutos (o mesmo link assinado da conferência);
 *  • o acerto lê-se pelo servidor, pelo caminho, e as partes pelo contrato dele;
 *  • sem link público e sem a URL do bucket: resposta inline, sem cache, com a marca de quem vê.
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

  const { data: acerto, error: eAcerto } = await admin
    .from("caucao_acertos")
    .select("id, contrato_id")
    .eq("comprovante_path", v.caminho)
    .maybeSingle();
  if (eAcerto || !acerto) return negar(404, "Arquivo não encontrado.");
  const { data: c, error: eContrato } = await admin.from("contratos").select("tenant_id, properties!inner(owner_id)").eq("id", acerto.contrato_id).maybeSingle();
  if (eContrato || !c) return negar(404, "Arquivo não encontrado.");
  const dono = (c.properties as unknown as { owner_id: string | null } | null)?.owner_id ?? null;
  const morador = (c.tenant_id as string | null) ?? null;
  const ehEquipe = user.id !== dono && user.id !== morador ? await ehAdmin(supabase, user.id) : false;
  if (!podeLerComprovante({ uid: user.id, ehEquipe, dono, morador, caminho: v.caminho })) return negar(404, "Arquivo não encontrado.");

  const { data: arquivo, error } = await admin.storage.from("conferencia").download(v.caminho);
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
