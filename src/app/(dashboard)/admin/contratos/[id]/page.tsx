import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileCheck2 } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { buttonClasses } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";
import { logModeracao } from "@/lib/data/moderacao-log";
import { carregarContratoAdmin, type ConferenciaAdmin } from "@/lib/data/contrato-admin";
import { ROTULO_ESTADO_CONFERENCIA, textoPrazoConferencia } from "@/lib/conferencia";
import { refContratoVN } from "@/lib/fiscal/fila-falhas";
import { fmtReais } from "@/lib/admin/visao-geral";
import { dataBRT, dataHoraBRT } from "@/lib/datas-brasilia";

export const metadata = { title: "Contrato — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PARTE = { proprietario: "Proprietário", inquilino: "Inquilino" } as const;
const TIPO = { entrada: "Conferência de entrada", saida: "Conferência de saída" } as const;
const FORMA: Record<string, string> = { pix: "Pix", boleto: "boleto", transferencia: "transferência", dinheiro: "dinheiro", outro: "outra forma" };

/**
 * Admin › contrato, SÓ LEITURA (Prompt 35B, F5). A guarda é no servidor: ehAdmin (com AAL2) antes de qualquer
 * leitura; quem não é admin recebe 404. Os dados vêm pelo cliente de serviço DEPOIS da checagem
 * (carregarContratoAdmin → getContratoParaEquipe). Toda abertura fica no registro de moderação ("ver_contrato").
 */
export default async function AdminContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createClient();
  if (!supabase) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) notFound();
  const c = await carregarContratoAdmin(id);
  if (!c) notFound();
  await logModeracao(supabase, user.id, "ver_contrato", "contrato", id);

  return (
    <div data-testid="admin-contrato">
      <Link href="/admin/contratos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Contratos
      </Link>
      <PageTitle title={`${refContratoVN(c.id)} · ${c.imovel}`} subtitle="Somente leitura. Datas e horas no horário de Brasília." />

      <Panel className="mb-4" data-testid="admin-contrato-cabecalho">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 break-words text-sm text-ink">
            Proprietário: <strong>{c.nomes.proprietario || "—"}</strong> · Inquilino: <strong>{c.nomes.inquilino || "—"}</strong>
          </p>
          <span className="rounded-full bg-sage-100 px-2.5 py-1 text-xs font-medium text-forest" data-testid="admin-contrato-selo">
            {c.selo}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">Registrado em {dataHoraBRT(c.criadoEm)}</p>
        <a href={`/api/admin/contratos/${c.id}/provas`} data-testid="admin-baixar-provas" className={buttonClasses({ variant: "outline", size: "sm", className: "mt-3 w-full sm:w-auto" })}>
          <Download className="h-4 w-4" /> Baixar pacote de provas
        </a>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Resumo e assinaturas" data-testid="admin-contrato-resumo">
          <ul className="space-y-1 text-sm text-ink">
            {c.resumo.map((l, i) => (
              <li key={i} className="break-words">
                {l}
              </li>
            ))}
          </ul>
          <p className="mt-3 break-all text-xs text-muted">Hash do resumo atual: {c.hashAtual}</p>
          <ul className="mt-3 space-y-2 text-sm" data-testid="admin-contrato-assinaturas">
            {c.assinaturas.length === 0 && <li className="text-muted">Nenhuma assinatura ainda.</li>}
            {c.assinaturas.map((a) => (
              <li key={a.papel} className="break-words">
                {PARTE[a.papel]} assinou em {dataHoraBRT(a.em)} —{" "}
                <span className={a.igual ? "text-forest" : "text-red-700"}>{a.igual ? "hash igual ao resumo atual" : "hash diferente do resumo atual"}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Pagamentos e taxa de serviço" data-testid="admin-contrato-pagamentos">
          {c.pagamentos.length === 0 ? (
            <p className="text-sm text-muted">Nenhum pagamento marcado.</p>
          ) : (
            <ul className="space-y-2 text-sm text-ink">
              {c.pagamentos.map((p, i) => (
                <li key={i} className={`break-words ${p.anuladoEm ? "text-muted" : ""}`} data-testid={p.anuladoEm ? "admin-pagamento-anulado" : "admin-pagamento"}>
                  {p.tipo === "caucao" ? "Caução" : "Valor mensal"} de {fmtReais(p.valor)} ({FORMA[p.forma] ?? p.forma}, em {dataBRT(`${p.dia}T12:00:00Z`)}) —{" "}
                  {p.anuladoEm ? "" : p.confirmadoEm ? `confirmado pelo inquilino em ${dataHoraBRT(p.confirmadoEm, { semEtiqueta: true })}` : "aguardando confirmação do inquilino"}
                  {p.anuladoEm && `registro anulado em ${dataHoraBRT(p.anuladoEm, { semEtiqueta: true })}${p.anuladoMotivo ? ` (${p.anuladoMotivo})` : ""}`}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-ink" data-testid="admin-contrato-totais">
            Confirmados: <strong>{fmtReais(c.totais.confirmado)}</strong> · Aguardando: <strong>{fmtReais(c.totais.aguardando)}</strong>
            {c.totais.anulados > 0 && <span className="text-muted"> · {c.totais.anulados} anulado(s), fora dos totais</span>}
          </p>
          <p className="mt-2 text-xs text-muted" data-testid="admin-contrato-taxa">
            Taxa de serviço: {c.taxa}
          </p>
        </Panel>
      </div>

      <Panel title="Conferências" className="mt-4" data-testid="admin-contrato-conferencias">
        {c.prazoEntradaEm && (
          <p className="mb-3 text-sm text-muted" data-testid="admin-conferencia-prazo" data-prazo={c.prazoEntradaEm}>
            Prazo da conferência de entrada: {textoPrazoConferencia(c.prazoEntradaEm)}.
          </p>
        )}
        {c.conferencias.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma conferência aberta.</p>
        ) : (
          <div className="grid gap-4">
            {c.conferencias.map((conf) => (
              <ConferenciaBloco key={conf.tipo} conf={conf} />
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted">Links das fotos e dos laudos valem 10 minutos; recarregue a página para gerar outros.</p>
      </Panel>
    </div>
  );
}

function ConferenciaBloco({ conf }: { conf: ConferenciaAdmin }) {
  return (
    <section className="min-w-0 rounded-xl border border-line p-3" data-testid={`admin-conferencia-${conf.tipo}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-title text-base font-bold text-ink">{TIPO[conf.tipo]}</h3>
        <span className="rounded-full bg-sage-100 px-2.5 py-1 text-xs font-medium text-forest" data-testid={`admin-conferencia-${conf.tipo}-estado`}>
          {ROTULO_ESTADO_CONFERENCIA[conf.estado]}
        </span>
      </div>
      {(["proprietario", "inquilino"] as const).map((parte) => {
        const itens = conf.itens.filter((i) => i.parte === parte);
        return (
          <div key={parte} className="mt-3">
            <p className="text-sm font-medium text-ink">
              Itens do {parte === "proprietario" ? "proprietário" : "inquilino"} ({itens.length})
            </p>
            {itens.length === 0 ? (
              <p className="text-sm text-muted">Nenhum item registrado.</p>
            ) : (
              <ul className="mt-1 divide-y divide-line text-sm">
                {itens.map((i) => (
                  <li key={i.id} className="flex items-start gap-3 py-2">
                    {i.fotoUrl && (
                      <a href={i.fotoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={i.fotoUrl} alt={`Foto: ${i.comodo}`} className="h-16 w-16 rounded-lg object-cover" />
                      </a>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{i.comodo}</p>
                      <p className="break-words text-muted">{i.descricao}</p>
                      <p className="text-xs text-muted">{dataHoraBRT(i.criadoEm, { semEtiqueta: true })}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      <ul className="mt-3 space-y-1 text-sm text-ink" data-testid={`admin-conferencia-${conf.tipo}-respostas`}>
        {conf.respostas.length === 0 && <li className="text-muted">Nenhuma resposta ainda.</li>}
        {conf.respostas.map((r) => (
          <li key={r.parte} className="break-words">
            {PARTE[r.parte]} {r.decisao === "confirmou" ? "confirmou" : "contestou"} em {dataHoraBRT(r.em, { semEtiqueta: true })}
            {r.motivo ? ` — motivo: ${r.motivo}` : ""}
          </li>
        ))}
      </ul>
      {conf.laudos.map((l) => (
        <p key={l.nome} className="mt-2 flex items-center gap-2 text-sm text-ink">
          <FileCheck2 className="h-4 w-4 shrink-0 text-forest" />
          <span className="min-w-0 break-all">
            Laudo independente ({PARTE[l.parte].toLowerCase()}, {dataHoraBRT(l.em, { semEtiqueta: true })}):{" "}
            {l.url ? (
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-medium text-forest underline">
                {l.nome}
              </a>
            ) : (
              l.nome
            )}
          </span>
        </p>
      ))}
    </section>
  );
}
