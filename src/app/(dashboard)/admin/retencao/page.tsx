import { ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { AvisoAdmin, ListaNumeros, NumeroHeroi, SeloEstado } from "@/components/admin/numeros";
import { INVENTARIO } from "@/config/retencao";
import { eliminaDeVerdade, motivoSimulado, textoPrazo } from "@/lib/minimizacao/regras";
import { dataBRT, dataHoraBRT } from "@/lib/datas-brasilia";
import { resumoDaSemana, rotuloMotivo, type LinhaLivro } from "@/lib/minimizacao/painel";
import { rotuloDoAdmin, tituloDoAdmin } from "@/config/menu-admin";
import { textoRealTeste } from "@/lib/admin/contagens";

export const metadata = { title: tituloDoAdmin("/admin/retencao"), robots: { index: false, follow: false } };

interface Simulado {
  dia: string;
  item: string;
  guardados: number | null;
  vencidos: number;
  vencidos_teste: number;
  real: boolean;
  prazo: string;
  base: string;
}

const POR_ID = new Map(INVENTARIO.map((i) => [i.id, i]));
/** Por que esta linha do relatório não apagou: o motivo do inventário; sem item (ou item que apaga), "nada venceu". */
const motivoDaLinha = (id: string) => {
  const item = POR_ID.get(id);
  return (item && motivoSimulado(item)) ?? "apaga de verdade; nesta rodada não havia nada vencido";
};
const n = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR"));

/**
 * Admin → Dados e retenção (Prompt 58). O inventário (o que guardamos, para quê, até quando), o relatório do dia
 * ("o que seria apagado hoje"), as eliminações reais da semana e os alertas. Só contagens: nenhum caminho de arquivo
 * nem conteúdo aparece aqui. Contas de teste contadas à parte. O layout de /admin já barra quem não é admin.
 */
export default async function AdminRetencaoPage() {
  const admin = createAdminClient();
  if (!admin) {
    return (
      <>
        <PageTitle title={rotuloDoAdmin("/admin/retencao")} />
        <EmptyState icon={ShieldCheck} title="Modo demonstração" text="Sem conexão com o banco: nenhum dado real para mostrar." action={<ButtonLink href="/admin" variant="secondary" size="sm">Voltar ao painel</ButtonLink>} />
      </>
    );
  }
  const agora = new Date();
  const desde = new Date(agora.getTime() - 7 * 86_400_000).toISOString();
  const [{ data: ultimo }, { data: livro, error: erroLivro }, { data: alertas }] = await Promise.all([
    admin.from("eliminacoes_simulado").select("dia").order("dia", { ascending: false }).limit(1).maybeSingle(),
    admin.from("eliminacoes_registro").select("tipo, motivo, teste, eliminado_em").gte("eliminado_em", desde).limit(10000),
    admin.from("eliminacoes_alertas").select("id, item, erro, criado_em").is("resolvido_em", null).order("criado_em", { ascending: false }).limit(50),
  ]);
  const dia = (ultimo?.dia as string | undefined) ?? null;
  const { data: relatorio } = dia ? await admin.from("eliminacoes_simulado").select("dia, item, guardados, vencidos, vencidos_teste, real, prazo, base").eq("dia", dia).order("item") : { data: [] };
  const semana = resumoDaSemana((livro ?? []) as LinhaLivro[], agora);
  const linhas = (relatorio ?? []) as Simulado[];
  const abertos = (alertas ?? []) as { id: string; item: string; erro: string; criado_em: string }[];

  return (
    <>
      <PageTitle title={rotuloDoAdmin("/admin/retencao")} subtitle="O que a Viva guarda, para quê e até quando. Guardamos o veredito, não o material." />
      {erroLivro && (
        <AvisoAdmin tom="atencao" className="mb-6">
          Não foi possível ler o livro de eliminações agora. Tente de novo em instantes.
        </AvisoAdmin>
      )}
      <NumeroHeroi rotulo="Eliminados de verdade em 7 dias" valor={textoRealTeste({ reais: semana.total, teste: semana.teste })} href="#semana" testId="retencao-semana-total" />
      <ListaNumeros
        className="mb-6"
        itens={[
          { rotulo: "Alertas abertos", valor: abertos.length, href: "#alertas" },
          { rotulo: "Itens no inventário", valor: INVENTARIO.length, href: "#inventario" },
        ]}
      />

      <Panel title="Alertas" className="mb-6 scroll-mt-24" id="alertas">
        {abertos.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma falha de eliminação em aberto.</p>
        ) : (
          <ul className="divide-y divide-sage-200 rounded-xl border border-sage-200" data-testid="retencao-alertas">
            {abertos.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <p className="font-semibold text-ink">{a.item}</p>
                <p className="text-xs text-muted">
                  {dataHoraBRT(a.criado_em)} · {a.erro}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={dia ? `O que seria apagado hoje (${dataBRT(`${dia}T12:00:00Z`)})` : "O que seria apagado hoje"} className="mb-6 scroll-mt-24" id="hoje">
        {linhas.length === 0 ? (
          <p className="text-sm text-muted">O relatório sai depois da primeira rodada da rotina diária.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="retencao-relatorio">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Guardados</th>
                  <th className="py-2 pr-3">Vencidos</th>
                  <th className="py-2 pr-3">Teste</th>
                  <th className="py-2 pr-3">Prazo</th>
                  <th className="py-2">Modo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-200">
                {linhas.map((l) => (
                  <tr key={l.item} data-item={l.item}>
                    <td className="py-2 pr-3 text-ink">
                      {l.item}
                      {/* ADMIN-6: "simulado" só onde a eliminação é simulada, com o porquê em uma linha. */}
                      {!l.real && <span className="block text-xs text-muted" data-testid="retencao-motivo-simulado">{motivoDaLinha(l.item)}</span>}
                    </td>
                    <td className="py-2 pr-3">{n(l.guardados)}</td>
                    <td className="py-2 pr-3 font-semibold">{n(l.vencidos)}</td>
                    <td className="py-2 pr-3">{n(l.vencidos_teste)}</td>
                    <td className="py-2 pr-3 text-xs">{l.prazo}</td>
                    <td className="py-2">
                      <SeloEstado tom={l.real ? "ok" : "neutro"}>{l.real ? "apagou" : "simulado"}</SeloEstado>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">Simulado: só conta, não apaga. Prazo com † é proposta; &quot;pendente – item 13&quot; aguarda o parecer jurídico.</p>
      </Panel>

      <Panel title="Eliminações reais da semana" className="mb-6 scroll-mt-24" id="semana">
        {semana.porItem.length === 0 ? (
          <p className="text-sm text-muted">Nada eliminado nos últimos 7 dias.</p>
        ) : (
          <ul className="divide-y divide-sage-200 rounded-xl border border-sage-200" data-testid="retencao-semana">
            {semana.porItem.map((g) => (
              <li key={`${g.tipo}|${g.motivo}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span className="text-ink">
                  {g.tipo} · {rotuloMotivo(g.motivo)}
                </span>
                <span className="font-semibold text-forest">
                  {g.n.toLocaleString("pt-BR")}
                  {g.teste ? <span className="ml-2 text-xs font-normal text-muted">+{g.teste} de teste</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">Eliminado do banco na data do registro; as cópias de segurança cifradas expiram em até ~90 dias.</p>
      </Panel>

      <Panel title="Inventário" className="scroll-mt-24" id="inventario">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" data-testid="retencao-inventario">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Dado</th>
                <th className="py-2 pr-3">Para quê</th>
                <th className="py-2 pr-3">Prazo</th>
                <th className="py-2 pr-3">Fica</th>
                <th className="py-2">Fase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage-200">
              {INVENTARIO.map((i) => (
                <tr key={i.id}>
                  <td className="py-2 pr-3 text-ink">{i.id}</td>
                  <td className="py-2 pr-3 text-xs">{i.dado}</td>
                  <td className="py-2 pr-3 text-xs">{i.finalidade}</td>
                  <td className="py-2 pr-3 text-xs">{textoPrazo(i)}</td>
                  <td className="py-2 pr-3 text-xs">{i.fica ?? "—"}</td>
                  <td className="py-2 text-xs" data-testid="inventario-modo" data-real={eliminaDeVerdade(i) ? "1" : "0"}>
                    {eliminaDeVerdade(i) ? (
                      "Apaga de verdade"
                    ) : (
                      <>
                        Simulado <span className="block text-muted">{motivoSimulado(i)}</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
