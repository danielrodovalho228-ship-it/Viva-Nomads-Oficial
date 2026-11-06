import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CAUCAO_PRAZOS_ATIVA } from "@/lib/flags";
import { contratoTemCaucao } from "@/lib/caucao/prazos";
import { linhasDoDossie, montarDossiePdf, type ItemDossie, type MetaFoto } from "@/lib/caucao/dossie";

/*
  E637 (b) — dossiê da caução em PDF (?contrato=<id>). Atrás da chave CAUCAO_PRAZOS_ATIVA. Só as duas partes do contrato
  (o RLS de caucao_prazos decide: pode_ver_contrato). Sem cache. A Viva não decide a disputa: entrega o dossiê às partes.
*/
export const runtime = "nodejs";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NEGADO = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  if (!CAUCAO_PRAZOS_ATIVA) return new NextResponse("Não encontrado", { status: 404, headers: NEGADO });
  const contratoId = new URL(request.url).searchParams.get("contrato") ?? "";
  if (!UUID_RE.test(contratoId)) return new NextResponse("Contrato inválido", { status: 400, headers: NEGADO });
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return new NextResponse("Indisponível", { status: 503, headers: NEGADO });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Entre na sua conta", { status: 401, headers: NEGADO });

  // Quem não é parte não enxerga a linha (RLS) → 404.
  const { data: prazo } = await supabase.from("caucao_prazos").select("saida_em, parecer_em").eq("contrato_id", contratoId).maybeSingle();
  if (!prazo) return new NextResponse("Não encontrado", { status: 404, headers: NEGADO });
  const { data: itensRls } = await supabase.from("caucao_desconto_itens").select("id, categoria, comodo, valor, status, contestacao_texto, foto_entrada_path, foto_saida_path, comprovante_path").eq("contrato_id", contratoId).order("criado_em");
  const linhas = (itensRls ?? []) as { id: string; categoria: string; comodo: string; valor: number; status: ItemDossie["status"]; contestacao_texto: string | null; foto_entrada_path: string; foto_saida_path: string; comprovante_path: string }[];

  const { data: c } = await admin.from("contratos").select("id, tenant_id, garantia, properties(owner_id, title)").eq("id", contratoId).maybeSingle();
  // E642: garantia única — contrato com seguro-fiança não tem caução, logo não tem dossiê dela.
  if (!contratoTemCaucao(c?.garantia as string | null | undefined)) return new NextResponse("Não encontrado", { status: 404, headers: NEGADO });
  const prop = (c?.properties as unknown as { owner_id?: string; title?: string } | null) ?? {};
  const ids = [prop.owner_id, c?.tenant_id as string | undefined].filter(Boolean) as string[];
  const { data: perfis } = await admin.from("profiles").select("id, full_name").in("id", ids);
  const nome = (id?: string) => ((perfis ?? []) as { id: string; full_name: string | null }[]).find((p) => p.id === id)?.full_name ?? "—";

  const baixar = async (caminho: string): Promise<Uint8Array | null> => {
    const { data } = await admin.storage.from("conferencia").download(caminho);
    return data ? new Uint8Array(await data.arrayBuffer()) : null;
  };
  // E640 (3): metadados do SERVIDOR, nunca do aparelho (o EXIF é removido no upload): a hora em que o arquivo chegou ao Storage (created_at) e quem
  // o enviou (a pasta do arquivo é o id de quem enviou; só as duas partes do contrato têm nome aqui).
  const metaDaFoto = async (caminho: string): Promise<MetaFoto> => {
    const [pasta, arquivo] = caminho.split("/");
    let registradaEm: string | null = null;
    try {
      const { data } = await admin.storage.from("conferencia").list(pasta, { search: arquivo, limit: 5 });
      const achado = (data ?? []).find((o) => o.name === arquivo) as { created_at?: string | null } | undefined;
      registradaEm = achado?.created_at ?? null;
    } catch {
      registradaEm = null;
    }
    const por = ids.includes(pasta) ? nome(pasta) : null;
    return { registradaEm, por: por && por !== "—" ? por : null };
  };
  const itens = await Promise.all(
    linhas.map(async (i) => ({
      id: i.id, categoria: i.categoria, comodo: i.comodo, valor: Number(i.valor), status: i.status, contestacao: i.contestacao_texto,
      fotoEntrada: await baixar(i.foto_entrada_path), fotoSaida: await baixar(i.foto_saida_path), comprovante: i.comprovante_path.split("/").pop() ?? null,
      metaEntrada: await metaDaFoto(i.foto_entrada_path), metaSaida: await metaDaFoto(i.foto_saida_path),
    })),
  );
  const resumo = linhasDoDossie({
    numero: `VN-CT-${contratoId.slice(0, 8).toUpperCase()}`,
    imovel: prop.title ?? "Imóvel",
    proprietario: nome(prop.owner_id),
    inquilino: nome(c?.tenant_id as string | undefined),
    saida: prazo.saida_em as string,
    parecerEm: (prazo.parecer_em as string | null) ?? null,
    itens,
  });
  const pdf = await montarDossiePdf({ resumo, itens, local: prop.title ?? "Imóvel do contrato" });
  return new NextResponse(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="dossie-caucao-${contratoId.slice(0, 8)}.pdf"`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
  });
}
