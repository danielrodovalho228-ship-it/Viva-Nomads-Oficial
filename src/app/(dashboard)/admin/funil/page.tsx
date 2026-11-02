import Link from "next/link";
import { TrendingDown } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { dataBRT } from "@/lib/datas-brasilia";
import { funilDaSemana } from "@/lib/data/funil";
import { FORMULAS, type ChaveFunil } from "@/lib/funil/regras";
import { rotuloDoAdmin, tituloDoAdmin } from "@/config/menu-admin";
import { hojeBR } from "@/lib/utils";
import { resolverPeriodo, rotuloPeriodo } from "@/lib/admin/visao-geral";
import { getVisaoGeral, cidadesComAnuncio } from "@/lib/data/admin-visao-geral";
import { baseDoFunil } from "@/lib/admin/contagens";
import { rotuloForaDaContagem } from "@/lib/eventos/trafego";
import { VisaoGeralClient } from "../visao-geral-client";

export const metadata = { title: tituloDoAdmin("/admin/funil"), robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const formatar = (v: number | null, tipo: "percentual" | "horas") => (v == null ? "—" : tipo === "percentual" ? `${String(v).replace(".", ",")}%` : `${String(v).replace(".", ",")} h`);
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
  const um = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  // E337 (01/11): sem período na URL, os indicadores abrem nos mesmos 7 dias do funil da semana (a página não mistura
  // janelas por padrão); com outro período escolhido, cada seção diz a própria janela no título.
  const periodo = resolverPeriodo({ periodo: um("periodo") ?? "7", de: um("de"), ate: um("ate") }, hojeBR());
  const cidade = (um("cidade") ?? "").trim().slice(0, 80) || null;
  // ADMIN-4: Crescimento, Oferta, Demanda e Liquidez saíram da inicial e moram aqui, abaixo do funil da semana.
  const [f, indicadores, cidades] = await Promise.all([
    funilDaSemana().catch(() => null),
    getVisaoGeral(periodo.inicio, periodo.fim, cidade),
    // Achado 65: falhou → o filtro de cidade avisa (null), sem derrubar o funil.
    cidadesComAnuncio().catch(() => null),
  ]);
  const avisoIndicadores = indicadores.ok
    ? null
    : {
        demo: "Sem conexão com o banco (modo demonstração): nenhum número real para mostrar.",
        sem_permissao: "Sem permissão para ver os números da plataforma.",
        sem_chave: "Chave de serviço não configurada: os números não podem ser lidos.",
        sem_migracao: "A função da visão geral ainda não existe no banco.",
        erro: "Não foi possível ler os números agora.",
      }[indicadores.motivo];
  if (!f) return <EmptyState icon={TrendingDown} title="Sem dados" text="Não foi possível ler o funil agora." action={null} />;
  const topo = f.etapas.find((e) => (e.queda ?? 0) > 0) ?? null;
  const lista = aberta ? f.etapas.find((e) => e.chave === aberta) : null;
  const foraRotulo = rotuloForaDaContagem(f.eventosFora);
  const janelaSemana = `Últimos 7 dias (até ${dataBRT(f.periodo.ate)}) contra os 7 anteriores`;
  const janelaIndicadores = `${periodo.id === "custom" || periodo.id === "ano" ? "Período escolhido" : `Últimos ${periodo.dias} dias`}: ${rotuloPeriodo(periodo.inicio, periodo.fim)}`;
  const mesmaJanela = periodo.id === "7";

  return (
    <div data-testid="admin-funil">
      <PageTitle title={rotuloDoAdmin("/admin/funil")} subtitle="Contas de teste fora. Cada seção diz a janela dos próprios números." />
      {foraRotulo && (
        <p className="-mt-2 mb-4 text-xs text-muted" data-testid="funil-fora-da-contagem" data-fora={f.eventosFora}>
          {foraRotulo} (suíte automática e contas de teste).
        </p>
      )}
      <section aria-labelledby="funil-semana-titulo" data-testid="funil-semana">
      <CabecalhoJanela id="funil-semana-titulo" titulo="Funil da semana" janela={janelaSemana} testid="funil-semana-janela" />
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
                Fórmula: {e.formula}. {baseDoFunil(e.tipo, e.base)} Semana anterior: {formatar(e.anterior, e.tipo)}.
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
      </section>
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
      <section className="mt-8 border-t-2 border-line pt-6" aria-labelledby="funil-indicadores-titulo" data-testid="funil-indicadores" data-janela={periodo.id}>
        <CabecalhoJanela
          id="funil-indicadores-titulo"
          titulo="Indicadores do período"
          janela={janelaIndicadores}
          nota={mesmaJanela ? "Mesma janela do funil da semana." : "Janela diferente do funil da semana acima: não compare os números das duas seções."}
          destaque={!mesmaJanela}
          testid="funil-indicadores-janela"
        />
        {cidades === null && (
          <p role="alert" className="mb-2 text-sm text-red-700" data-testid="filtro-cidades-falha">
            Não foi possível carregar a lista de cidades do filtro agora. Recarregue a página para tentar de novo.
          </p>
        )}
        <VisaoGeralClient dados={indicadores.ok ? indicadores.dados : null} aviso={avisoIndicadores} periodo={periodo} cidade={cidade} cidades={cidades ?? []} base="/admin/funil" />
      </section>
    </div>
  );
}

/** E337: o título da seção com a janela dos números em destaque — nenhum número é lido com o período do vizinho. */
function CabecalhoJanela({ id, titulo, janela, nota, destaque = false, testid }: { id: string; titulo: string; janela: string; nota?: string; destaque?: boolean; testid: string }) {
  return (
    <div className="mb-4 flex flex-col gap-2">
      <h2 id={id} className="font-title text-xl font-semibold text-ink">
        {titulo}
      </h2>
      <p data-testid={testid} className="w-fit max-w-full rounded-lg bg-sage-100 px-3 py-2 text-sm font-semibold text-forest">
        {janela}
      </p>
      {nota && (
        <p data-testid={`${testid}-nota`} className={destaque ? "text-sm font-semibold text-amber-800" : "text-xs text-muted"}>
          {nota}
        </p>
      )}
    </div>
  );
}
