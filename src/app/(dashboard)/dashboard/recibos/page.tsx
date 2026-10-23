import type { Metadata } from "next";
import { Download, FileText } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink, Button } from "@/components/ui/button";
import { brl, dataBR } from "@/lib/fiscal/documento";
import { recibosDaPessoa } from "@/lib/data/recibos";
import { AVISO_FIXO, ROTULO_RECIBO, ehMes, filtrarRecibos, informeAnual, mesesComDocumento, resumoCarneLeao, rotuloMes } from "@/lib/recibos/regras";
import { hojeBR } from "@/lib/utils";

export const metadata: Metadata = { title: "Recibos e notas" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const campo = "h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink";

/**
 * Prompt 39-B, fase 1 — "Recibos e notas" do PROPRIETÁRIO: os documentos que a Viva já gerou (recibos, comprovantes e
 * termos), o resumo do mês para o Carnê-Leão por pagador e o informe anual. Nada é emitido aqui. Os filtros vão na URL
 * (imóvel e mês); o CPF do pagador aparece só nesta tela e no PDF.
 */
export default async function RecibosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const d = await recibosDaPessoa("dono");
  const recibos = d?.recibos ?? [];
  const meses = mesesComDocumento(recibos);
  const mesAtual = hojeBR().slice(0, 7);
  const mesParam = typeof sp.mes === "string" ? sp.mes : "";
  const mes = ehMes(mesParam) ? mesParam : (meses[0] ?? mesAtual);
  const imovelParam = typeof sp.imovel === "string" && UUID.test(sp.imovel) ? sp.imovel : "";
  const doImovel = filtrarRecibos(recibos, { imovelId: imovelParam || null });
  const resumo = resumoCarneLeao(doImovel, mes);
  const lista = filtrarRecibos(doImovel, { mes });
  const ano = Number(mes.slice(0, 4));
  const informe = informeAnual(recibos, ano);
  const opcoesMes = [...new Set([mes, mesAtual, ...meses])].sort().reverse();
  const qsImovel = imovelParam ? `&imovel=${imovelParam}` : "";

  return (
    <div data-testid="recibos-dono">
      <PageTitle title="Recibos e notas" subtitle="Os recibos dos seus aluguéis, o resumo de cada mês e o informe do ano." />
      <p className="mb-6 rounded-xl border border-sage-200 bg-white px-4 py-3 text-sm text-ink" data-testid="recibos-aviso">
        {AVISO_FIXO}
      </p>

      <form method="get" className="mb-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" data-testid="recibos-filtros">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Imóvel</span>
          <select name="imovel" defaultValue={imovelParam} className={campo} data-testid="recibos-filtro-imovel">
            <option value="">Todos os imóveis</option>
            {(d?.imoveis ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.titulo}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Mês</span>
          <select name="mes" defaultValue={mes} className={campo} data-testid="recibos-filtro-mes">
            {opcoesMes.map((m) => (
              <option key={m} value={m}>
                {rotuloMes(m)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="secondary" size="sm" className="h-11" data-testid="recibos-filtrar">
          Ver
        </Button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title={`Documentos de ${rotuloMes(mes)}`} data-testid="recibos-lista">
          {lista.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nenhum documento neste mês"
              text="O recibo sai quando o morador confirma o pagamento em Contratos & blocos."
              action={<ButtonLink href="/dashboard/contratos" variant="secondary" size="sm">Ver contratos</ButtonLink>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {lista.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3" data-testid="recibo-item" data-valor={r.valor} data-tipo={r.tipo}>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">
                      {ROTULO_RECIBO[r.tipo]} · {r.numero}
                    </span>
                    <span className="block text-xs text-muted">
                      {dataBR(r.data)} · {r.imovelTitulo} · {r.pagador.nome}
                      {r.anulado ? " · anulado" : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-ink">{brl(r.valor)}</span>
                    <a href={`/api/documentos/${r.id}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-forest underline underline-offset-4" data-testid="recibo-baixar">
                      <Download className="h-4 w-4" aria-hidden /> PDF
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="grid content-start gap-6">
          <Panel title="Resumo do mês para o Carnê-Leão" data-testid="recibos-resumo">
            <p className="text-sm text-muted">{rotuloMes(mes)}</p>
            <p className="mt-1 font-title text-2xl font-semibold text-ink" data-testid="recibos-resumo-total" data-total={resumo.total}>
              {brl(resumo.total)}
            </p>
            {resumo.porPagador.length > 0 && (
              <ul className="mt-3 divide-y divide-line text-sm" data-testid="recibos-por-pagador">
                {resumo.porPagador.map((p) => (
                  <li key={`${p.nome}-${p.doc}`} className="flex items-start justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-ink">{p.nome}</span>
                      {p.doc && <span className="block text-xs text-muted">CPF/CNPJ {p.doc}</span>}
                    </span>
                    <span className="font-semibold text-ink">{brl(p.total)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted" data-testid="recibos-formula">
              Cálculo: {resumo.formula}. Caução não entra.
            </p>
            <a
              href={`/api/recibos/resumo?mes=${mes}${qsImovel}`}
              className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-forest underline underline-offset-4"
              data-testid="recibos-resumo-pdf"
            >
              <Download className="h-4 w-4" aria-hidden /> Baixar o resumo (PDF)
            </a>
          </Panel>

          <Panel id="informe" title={`Informe anual ${ano}`} className="scroll-mt-24" data-testid="recibos-informe">
            <p className="text-sm text-muted">Total por pagador no ano, para a declaração (DIRPF).</p>
            <p className="mt-1 font-title text-xl font-semibold text-ink">{brl(informe.total)}</p>
            <div className="mt-3 flex flex-wrap gap-x-4">
              <a href={`/api/recibos/informe?ano=${ano}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-forest underline underline-offset-4" data-testid="recibos-informe-pdf">
                <Download className="h-4 w-4" aria-hidden /> PDF
              </a>
              <a href={`/api/recibos/informe?ano=${ano}&formato=csv`} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-forest underline underline-offset-4" data-testid="recibos-informe-csv">
                <Download className="h-4 w-4" aria-hidden /> CSV
              </a>
            </div>
            <a
              href={`/api/recibos/ano?ano=${ano}`}
              className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-forest underline underline-offset-4"
              data-testid="recibos-baixar-ano"
            >
              <Download className="h-4 w-4" aria-hidden /> Baixar o ano (PDFs + informe)
            </a>
          </Panel>
        </div>
      </div>
    </div>
  );
}
