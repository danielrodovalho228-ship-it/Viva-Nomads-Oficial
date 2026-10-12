import Link from "next/link";
import { Camera, CheckCircle2, Clock, ClipboardList, Handshake } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Panel, StatCard, EmptyState } from "@/components/dashboard/primitives";
import { formatBRL } from "@/lib/utils";
import { TAXA_PARCERIA_PADRAO } from "@/lib/fotografos/regras";
import { AprovarBotao, CadastroForm, TaxaForm } from "./forms";

export const metadata = { title: "Fotógrafos — Admin" };

const STATUS_PEDIDO: Record<string, { rotulo: string; cor: string }> = {
  enviado: { rotulo: "Aguardando fotógrafo", cor: "bg-amber-100 text-amber-800" },
  aceito: { rotulo: "Aceito", cor: "bg-sky-100 text-sky-800" },
  entregue: { rotulo: "Entregue", cor: "bg-lime-100 text-forest" },
  concluido: { rotulo: "Concluído", cor: "bg-sage-100 text-forest" },
  recusado: { rotulo: "Não seguiu", cor: "bg-surface-2 text-muted" },
  cancelado: { rotulo: "Cancelado", cor: "bg-surface-2 text-muted" },
};
const dataBR = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");

/**
 * Admin → Fotógrafos parceiros: números, cadastro, aprovação e pedidos.
 * Padrão das telas do admin (PageTitle + StatCard + Panel, largura cheia da casca, cartões no celular e tabela no computador).
 * O layout de /admin já barra quem não é admin; a RLS barra de novo no banco.
 */
export default async function AdminFotografosPage() {
  const supabase = await createClient();
  if (!supabase) {
    return (
      <>
        <PageTitle title="Fotógrafos parceiros" />
        <EmptyState icon={Camera} title="Modo demonstração" text="Sem conexão com o banco: nenhum dado real para mostrar." />
      </>
    );
  }

  const [{ data: fotografos, error: e1 }, { data: pedidos, error: e2 }, { data: cfg }] = await Promise.all([
    supabase
      .from("fotografos")
      .select("id, nome_comercial, cidades, pacote_fotos, pacote_prazo_dias, pacote_preco, nota_media, avaliacoes_qtd, aprovado, portfolio_url")
      .order("criado_em", { ascending: false })
      .limit(200),
    supabase
      .from("fotografo_pedidos")
      .select("id, cidade, uf, data_sugerida, status, taxa_valor, taxa_paga_em, criado_em, fotografos(nome_comercial)")
      .order("criado_em", { ascending: false })
      .limit(100),
    supabase.from("config_parceria").select("valor").eq("chave", "taxa_parceria_fotografo").maybeSingle(),
  ]);
  const taxa = cfg?.valor != null ? Number(cfg.valor) : TAXA_PARCERIA_PADRAO;
  const lista = fotografos ?? [];
  const peds = pedidos ?? [];
  const aprovados = lista.filter((f) => f.aprovado).length;
  const abertos = peds.filter((p) => p.status === "enviado" || p.status === "aceito").length;
  const cidades = new Set(lista.flatMap((f) => (f.cidades as string[]) ?? []).map((c) => c.trim().toLowerCase())).size;

  return (
    <>
      <PageTitle
        title="Fotógrafos parceiros"
        subtitle="Cadastro, aprovação, taxa de parceria e pedidos dos donos."
        action={
          <Link href="/admin/parceiros" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sage-200 bg-white px-4 text-sm font-semibold text-ink hover:border-sage">
            <Handshake className="h-4 w-4" /> Todos os parceiros
          </Link>
        }
      />

      {(e1 || e2) && (
        <p role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Não foi possível ler todos os dados agora. Tente de novo em instantes.
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Aprovados" value={aprovados} icon={CheckCircle2} />
        <StatCard label="Em análise" value={lista.length - aprovados} icon={Clock} />
        <StatCard label="Cidades atendidas" value={cidades} icon={Camera} />
        <StatCard label="Pedidos abertos" value={abertos} icon={ClipboardList} href="#pedidos" />
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <Panel title="Taxa de parceria" className="lg:col-span-1">
          <p className="mb-3 text-sm text-muted">Paga pelo fotógrafo ao aceitar o pedido. A Viva não recebe o dinheiro do serviço.</p>
          <ul className="mb-4 space-y-1 rounded-xl bg-sage-100 p-3 text-sm text-ink">
            <li>Até 20 fotos: <strong>R$ 40</strong></li>
            <li>21 a 40 fotos: <strong>R$ 60</strong></li>
            <li>Acima de 40 fotos: <strong>R$ 80</strong></li>
          </ul>
          <TaxaForm taxa={taxa} />
          <p className="mt-2 text-xs text-muted">Valor único usado hoje nos pedidos. As faixas acima entram na próxima etapa da jornada do parceiro.</p>
        </Panel>

        <Panel title="Cadastrar fotógrafo" className="lg:col-span-2">
          <CadastroForm />
        </Panel>
      </div>

      <Panel title={`Fotógrafos (${lista.length})`} className="mt-4 sm:mt-6">
        {lista.length === 0 ? (
          <EmptyState icon={Camera} title="Nenhum fotógrafo ainda" text="Cadastre acima ou aprove quem se inscreveu em /parceiros. Aprovados aparecem na busca pública por CEP." />
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {lista.map((f) => (
                <li key={f.id} className="rounded-xl border border-sage-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-semibold text-ink">{f.nome_comercial}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${f.aprovado ? "bg-lime-100 text-forest" : "bg-amber-100 text-amber-800"}`}>
                      {f.aprovado ? "Aprovado" : "Em análise"}
                    </span>
                  </div>
                  <p className="mt-1 text-muted">{((f.cidades as string[]) ?? []).join(", ")}</p>
                  <p className="mt-1 text-ink">
                    {f.pacote_fotos} fotos · {f.pacote_prazo_dias} dias · {formatBRL(Number(f.pacote_preco))}
                  </p>
                  <p className="text-muted">{f.nota_media ? `Nota ${Number(f.nota_media).toFixed(1)} (${f.avaliacoes_qtd})` : "Sem avaliações"}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <AprovarBotao id={f.id} aprovado={f.aprovado} />
                    {f.portfolio_url && (
                      <a href={f.portfolio_url} target="_blank" rel="noopener noreferrer nofollow" className="text-forest underline">Portfólio</a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-sage-200 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Fotógrafo</th>
                    <th className="py-2 pr-3 font-medium">Cidades</th>
                    <th className="py-2 pr-3 font-medium">Pacote</th>
                    <th className="py-2 pr-3 font-medium">Avaliação</th>
                    <th className="py-2 pr-3 font-medium">Situação</th>
                    <th className="py-2 font-medium"><span className="sr-only">Ação</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sage-100">
                  {lista.map((f) => (
                    <tr key={f.id}>
                      <td className="py-2.5 pr-3 font-semibold text-ink">
                        {f.nome_comercial}
                        {f.portfolio_url && (
                          <a href={f.portfolio_url} target="_blank" rel="noopener noreferrer nofollow" className="ml-2 text-xs font-normal text-forest underline">portfólio</a>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-muted">{((f.cidades as string[]) ?? []).join(", ")}</td>
                      <td className="py-2.5 pr-3 text-ink">{f.pacote_fotos} fotos · {f.pacote_prazo_dias} d · {formatBRL(Number(f.pacote_preco))}</td>
                      <td className="py-2.5 pr-3 text-muted">{f.nota_media ? `${Number(f.nota_media).toFixed(1)} (${f.avaliacoes_qtd})` : "—"}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${f.aprovado ? "bg-lime-100 text-forest" : "bg-amber-100 text-amber-800"}`}>
                          {f.aprovado ? "Aprovado" : "Em análise"}
                        </span>
                      </td>
                      <td className="py-2.5 text-right"><AprovarBotao id={f.id} aprovado={f.aprovado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      <div id="pedidos" className="scroll-mt-24">
        <Panel title={`Pedidos de fotos (${peds.length})`} className="mt-4 sm:mt-6">
          {peds.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Nenhum pedido ainda" text="Quando um dono pedir fotos a um parceiro, o pedido aparece aqui com a situação e a taxa." />
          ) : (
            <ul className="divide-y divide-sage-100">
              {peds.map((p) => {
                const f = p.fotografos as unknown as { nome_comercial: string } | null;
                const st = STATUS_PEDIDO[p.status] ?? { rotulo: p.status, cor: "bg-surface-2 text-muted" };
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{f?.nome_comercial ?? "—"}</p>
                      <p className="text-muted">
                        {p.cidade}/{p.uf} · data sugerida {dataBR(p.data_sugerida)} · pedido em {dataBR(p.criado_em)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cor}`}>{st.rotulo}</span>
                      <span className="text-xs text-muted">
                        {p.taxa_paga_em ? `taxa paga${p.taxa_valor ? ` · ${formatBRL(Number(p.taxa_valor))}` : ""}` : "taxa pendente"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
