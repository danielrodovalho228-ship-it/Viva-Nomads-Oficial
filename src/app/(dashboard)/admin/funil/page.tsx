import Link from "next/link";
import { TrendingDown } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { dataBRT } from "@/lib/datas-brasilia";
import { funilDaSemana } from "@/lib/data/funil";
import { FORMULAS, type ChaveFunil } from "@/lib/funil/regras";
import { rotuloDoAdmin, tituloDoAdmin } from "@/config/menu-admin";

export const metadata = { title: tituloDoAdmin("/admin/funil"), robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const formatar = (v: number | null, tipo: "percentual" | "horas") => (v == null ? "sem base" : tipo === "percentual" ? `${String(v).replace(".", ",")}%` : `${String(v).replace(".", ",")} h`);
/** Onde cada item da lista abre (sem dado pessoal na URL: o id só vai na busca do próprio admin). */
const HREF: Record<ChaveFunil, (id: string) => string> = {
  visita_conta: (id) => `/admin/usuarios?q=${id}`,
  conta_intencao: (id) => `/admin/usuarios?q=${id}`,
  busca_pedido: (id) => `/admin/usuarios?q=${id}`,
  rascunho_publicado: (id) => `/admin/imoveis?q=${id}`,
  solicitacao_aprovacao: () => "/admin/parceiros?aba=pendentes",
  verificacao: (id) => `/admin/usuarios?q=${id}`,
};
const ROTULO_LISTA: Record<ChaveFunil, string> = {
  visita_conta: "Contas criadas na semana",
  conta_intencao: "Contas novas que ainda não responderam a intenção",
  busca_pedido: "Quem enviou o 1º pedido na semana",
  rascunho_publicado: "Anúncios iniciados e ainda não publicados",
  solicitacao_aprovacao: "Solicitações de parceria decididas na semana",
  verificacao: "Quem iniciou a verificação e ainda não confirmou",
};

/**
 * Admin → Funil (Prompt 50), na anatomia "decisões primeiro": o topo é a MAIOR QUEDA da semana contra a anterior;
 * cada número traz a fórmula escrita e abre a lista que ele conta. Contas de teste fora. Lido do que já existe.
 */
export default async function AdminFunilPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const aberta = typeof sp.etapa === "string" && sp.etapa in FORMULAS ? (sp.etapa as ChaveFunil) : null;
  const f = await funilDaSemana().catch(() => null);
  if (!f) return <EmptyState icon={TrendingDown} title="Sem dados" text="Não foi possível ler o funil agora." action={null} />;
  const topo = f.etapas.find((e) => (e.queda ?? 0) > 0) ?? null;
  const lista = aberta ? f.etapas.find((e) => e.chave === aberta) : null;

  return (
    <div data-testid="admin-funil">
      <PageTitle title={rotuloDoAdmin("/admin/funil")} subtitle={`Últimos 7 dias (até ${dataBRT(f.periodo.ate)}) contra os 7 anteriores · contas de teste fora`} />
      <Panel className="mb-6" data-testid="funil-topo">
        {topo ? (
          <p className="text-sm text-ink">
            Maior queda da semana: <strong>{topo.rotulo}</strong> — {formatar(topo.valor, topo.tipo)} (antes {formatar(topo.anterior, topo.tipo)}).
          </p>
        ) : (
          <p className="text-sm text-muted">Nenhuma etapa caiu na semana.</p>
        )}
      </Panel>
      <Panel title="Etapas" className="mb-6">
        <ul className="divide-y divide-line">
          {f.etapas.map((e) => (
            <li key={e.chave} className="py-3" data-testid="funil-etapa" data-chave={e.chave} data-valor={e.valor ?? ""}>
              <Link href={`/admin/funil?etapa=${e.chave}#lista`} className="flex flex-wrap items-baseline justify-between gap-2 text-ink underline-offset-4 hover:underline">
                <span className="font-semibold">{e.rotulo}</span>
                <span className="font-title text-lg">{formatar(e.valor, e.tipo)}</span>
              </Link>
              <p className="text-xs text-muted">
                Fórmula: {e.formula}. {e.tipo === "percentual" ? `${e.base.de} de ${e.base.total}.` : `${e.base.total} tempo(s).`} Semana anterior: {formatar(e.anterior, e.tipo)}.
              </p>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Verificação por degrau" className="mb-6" data-testid="funil-verificacao">
        <ul className="grid gap-1 text-sm">
          {f.degrausVerificacao.map((d) => (
            <li key={d.degrau} data-degrau={d.degrau}>
              {d.rotulo}: {d.n} {d.pct != null ? `(${String(d.pct).replace(".", ",")}%)` : ""}
            </li>
          ))}
        </ul>
      </Panel>
      {lista && (
        <Panel title={ROTULO_LISTA[lista.chave]} data-testid="funil-lista" id="lista">
          {lista.ids.length === 0 ? (
            <p className="text-sm text-muted">Ninguém nesta lista.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {lista.ids.slice(0, 200).map((id) => (
                <li key={id}>
                  <Link href={HREF[lista.chave](id)} className="underline underline-offset-4">
                    {id.slice(0, 8)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
