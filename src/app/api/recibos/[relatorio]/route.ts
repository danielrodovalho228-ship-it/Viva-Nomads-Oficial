import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_DOCUMENTOS } from "@/lib/fiscal/emitir";
import { gerarPdf } from "@/lib/fiscal/pdf";
import { pdfsDosDocumentos, recibosDaPessoa, servicosConcluidosDoParceiro } from "@/lib/data/recibos";
import { ehAno, ehMes, filtrarRecibos, informeAnual, informeCsv, resumoAnualParceiro, resumoCarneLeao, resumoReembolso } from "@/lib/recibos/regras";
import { conteudoInforme, conteudoParceiroAnual, conteudoReembolso, conteudoResumoMes } from "@/lib/recibos/relatorios";
import { montarZip, type ArquivoZip } from "@/lib/recibos/zip";

/**
 * Prompt 39-B, fase 1 — relatórios de "Recibos e notas" (PDF, CSV e o ZIP do ano). Cada um sai SÓ dos documentos que
 * a pessoa já pode ler (RLS); nada é gravado. Na URL vão só mês, ano e ids — nunca CPF.
 *   resumo?mes=aaaa-mm[&imovel=id]   Carnê-Leão do dono (PDF)
 *   informe?ano=aaaa[&formato=csv][&papel=morador]   informe anual (PDF ou CSV)
 *   ano?ano=aaaa   ZIP com os PDFs do ano + o informe (dono)
 *   reembolso?contrato=id   resumo para reembolso de uma estadia (morador)
 *   parceiro?ano=aaaa   resumo anual de serviços (parceiro)
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function arquivo(bytes: Uint8Array | string, nome: string, tipo: string) {
  const corpo = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  return new NextResponse(Buffer.from(corpo), {
    status: 200,
    headers: {
      "Content-Type": tipo,
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

const erro = (status: number, mensagem: string) => NextResponse.json({ error: mensagem }, { status });

export async function GET(req: NextRequest, { params }: { params: Promise<{ relatorio: string }> }) {
  const { relatorio } = await params;
  const q = req.nextUrl.searchParams;
  const agora = new Date().toISOString();
  const anoParam = Number(q.get("ano"));

  if (relatorio === "parceiro") {
    if (!ehAno(anoParam)) return erro(400, "Ano inválido.");
    const p = await servicosConcluidosDoParceiro();
    if (!p) return erro(401, "Entre na sua conta de parceiro.");
    const pdf = await gerarPdf(conteudoParceiroAnual(resumoAnualParceiro(p.servicos, anoParam), p.parceiro, agora));
    return arquivo(pdf, `resumo-servicos-${anoParam}.pdf`, "application/pdf");
  }

  const papel = relatorio === "reembolso" || q.get("papel") === "morador" ? "morador" : "dono";
  const d = await recibosDaPessoa(papel);
  if (!d) return erro(401, "Entre na sua conta.");

  if (relatorio === "resumo") {
    const mes = q.get("mes");
    if (!ehMes(mes)) return erro(400, "Mês inválido.");
    const imovel = q.get("imovel");
    if (imovel && !UUID.test(imovel)) return erro(400, "Imóvel inválido.");
    const lista = filtrarRecibos(d.recibos, { imovelId: imovel });
    const titulo = imovel ? (d.imoveis.find((i) => i.id === imovel)?.titulo ?? null) : null;
    const pdf = await gerarPdf(conteudoResumoMes(resumoCarneLeao(lista, mes), d.eu, titulo, agora));
    return arquivo(pdf, `resumo-carne-leao-${mes}.pdf`, "application/pdf");
  }

  if (relatorio === "informe") {
    if (!ehAno(anoParam)) return erro(400, "Ano inválido.");
    const inf = informeAnual(d.recibos, anoParam, papel === "dono" ? "pagador" : "recebedor");
    if (q.get("formato") === "csv") return arquivo(informeCsv(inf), `informe-${anoParam}.csv`, "text/csv; charset=utf-8");
    const pdf = await gerarPdf(conteudoInforme(inf, d.eu, agora));
    return arquivo(pdf, `${papel === "dono" ? "informe-anual" : "resumo-anual"}-${anoParam}.pdf`, "application/pdf");
  }

  if (relatorio === "reembolso") {
    const contrato = q.get("contrato") ?? "";
    if (!UUID.test(contrato)) return erro(400, "Estadia inválida.");
    // Só uma estadia em que a pessoa é o morador (o RLS e o filtro tenant_id já garantem: outra estadia = nada).
    if (!d.recibos.some((r) => r.contratoId === contrato)) return erro(404, "Estadia sem recibos.");
    const pdf = await gerarPdf(conteudoReembolso(resumoReembolso(d.recibos, contrato), d.eu, agora));
    return arquivo(pdf, "resumo-reembolso.pdf", "application/pdf");
  }

  if (relatorio === "ano") {
    if (!ehAno(anoParam)) return erro(400, "Ano inválido.");
    const doAno = d.recibos.filter((r) => r.data.slice(0, 4) === String(anoParam));
    const caminhos = await pdfsDosDocumentos(doAno.map((r) => r.id));
    const admin = createAdminClient();
    if (!admin) return erro(503, "Indisponível agora.");
    const arquivos: ArquivoZip[] = [];
    for (const c of caminhos) {
      const { data } = await admin.storage.from(BUCKET_DOCUMENTOS).download(c.pdf_path);
      if (data) arquivos.push({ nome: `${c.numero}.pdf`, dados: new Uint8Array(await data.arrayBuffer()) });
    }
    const inf = informeAnual(d.recibos, anoParam, "pagador");
    arquivos.push({ nome: `informe-anual-${anoParam}.pdf`, dados: await gerarPdf(conteudoInforme(inf, d.eu, agora)) });
    arquivos.push({ nome: `informe-anual-${anoParam}.csv`, dados: new TextEncoder().encode(informeCsv(inf)) });
    return arquivo(montarZip(arquivos), `recibos-${anoParam}.zip`, "application/zip");
  }

  return erro(404, "Relatório não encontrado.");
}
