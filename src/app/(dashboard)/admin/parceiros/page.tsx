import Link from "next/link";
import { Camera, Handshake, Inbox, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Panel, StatCard, EmptyState } from "@/components/dashboard/primitives";
import { TIPOS_PARCEIRO } from "@/lib/parceiros/interesse";
import { StatusInteresse } from "./status-interesse";

export const metadata = { title: "Parceiros — Admin" };

const FILTROS = [
  { valor: "novo", rotulo: "Novos" },
  { valor: "contatado", rotulo: "Contatados" },
  { valor: "arquivado", rotulo: "Arquivados" },
  { valor: "todos", rotulo: "Todos" },
] as const;

const rotuloTipo = (t: string) => TIPOS_PARCEIRO.find((x) => x.valor === t)?.rotulo.split(" (")[0] ?? t;
const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/**
 * Admin → Parceiros: central da rede de parceiros (números, interessados por tipo e status, atalho para fotógrafos).
 * Segue o padrão das telas do admin (PageTitle + StatCard + Panel, largura cheia da casca). O layout de /admin exige admin;
 * a RLS barra de novo no banco.
 */
export default async function AdminParceirosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filtro = (FILTROS.some((f) => f.valor === sp.status) ? sp.status : "novo") as (typeof FILTROS)[number]["valor"];

  const supabase = await createClient();
  if (!supabase) {
    return (
      <>
        <PageTitle title="Parceiros" subtitle="Rede de parceiros da Viva." />
        <EmptyState icon={Handshake} title="Modo demonstração" text="Sem conexão com o banco: nenhum dado real para mostrar." />
      </>
    );
  }

  let consulta = supabase
    .from("parceiros_interesse")
    .select("id, tipo, nome, cidade, uf, whatsapp, email, site, status, criado_em")
    .order("criado_em", { ascending: false })
    .limit(200);
  if (filtro !== "todos") consulta = consulta.eq("status", filtro);

  const [lista, todos, fotAprov, fotPend, pedAbertos] = await Promise.all([
    consulta,
    supabase.from("parceiros_interesse").select("tipo, status"),
    supabase.from("fotografos").select("id", { count: "exact", head: true }).eq("aprovado", true),
    supabase.from("fotografos").select("id", { count: "exact", head: true }).eq("aprovado", false),
    supabase.from("fotografo_pedidos").select("id", { count: "exact", head: true }).in("status", ["enviado", "aceito"]),
  ]);

  const erroLeitura = Boolean(lista.error || todos.error);
  const interesses = lista.data ?? [];
  const base = todos.data ?? [];
  const novos = base.filter((r) => r.status === "novo").length;
  const porTipo = TIPOS_PARCEIRO.map((t) => ({
    ...t,
    total: base.filter((r) => r.tipo === t.valor).length,
    novos: base.filter((r) => r.tipo === t.valor && r.status === "novo").length,
  }));
  const n = (c: number | null) => (c ?? 0).toString();

  return (
    <>
      <PageTitle
        title="Parceiros"
        subtitle="Interessados, fotógrafos e pedidos da rede de parceiros."
        action={
          <Link href="/admin/fotografos" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-forest px-4 text-sm font-semibold text-white">
            <Camera className="h-4 w-4" /> Fotógrafos
          </Link>
        }
      />

      {erroLeitura && (
        <p role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Não foi possível ler todos os dados agora. Tente de novo em instantes.
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Interessados novos" value={novos} icon={Inbox} href="/admin/parceiros?status=novo" />
        <StatCard label="Fotógrafos aprovados" value={n(fotAprov.count)} icon={Camera} href="/admin/fotografos" />
        <StatCard label="Fotógrafos em análise" value={n(fotPend.count)} icon={Handshake} href="/admin/fotografos" />
        <StatCard label="Pedidos de foto abertos" value={n(pedAbertos.count)} icon={ClipboardList} href="/admin/fotografos#pedidos" />
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <Panel title="Por tipo de parceria" className="lg:col-span-1">
          <ul className="divide-y divide-sage-100">
            {porTipo.map((t) => (
              <li key={t.valor} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate text-ink">{t.rotulo.split(" (")[0]}</span>
                <span className="shrink-0 text-muted">
                  <strong className="text-forest">{t.total}</strong>
                  {t.novos > 0 && <span className="ml-2 rounded-full bg-lime-100 px-2 py-0.5 text-xs font-semibold text-forest">{t.novos} novo{t.novos > 1 ? "s" : ""}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Fotógrafos estão abertos. Serviços e seguros ficam em lista de espera por cidade.</p>
        </Panel>

        <Panel title="Interessados" className="lg:col-span-2">
          <nav aria-label="Filtrar por status" className="mb-4 flex flex-wrap gap-1.5">
            {FILTROS.map((f) => (
              <Link
                key={f.valor}
                href={`/admin/parceiros?status=${f.valor}`}
                aria-current={filtro === f.valor ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-medium ${
                  filtro === f.valor ? "border-forest bg-forest text-white" : "border-sage-200 bg-white text-ink hover:border-sage"
                }`}
              >
                {f.rotulo}
              </Link>
            ))}
          </nav>

          {interesses.length === 0 ? (
            <EmptyState icon={Inbox} title="Nada por aqui" text="Nenhum interesse de parceria com esse status. Quem preencher “Quero ser parceiro” em /parceiros aparece aqui." />
          ) : (
            <>
              {/* Celular e app: cartões */}
              <ul className="space-y-3 md:hidden">
                {interesses.map((p) => (
                  <li key={p.id} className="rounded-xl border border-sage-200 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{p.nome}</p>
                        <p className="text-muted">{rotuloTipo(p.tipo)} · {p.cidade}/{p.uf}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted">{dataBR(p.criado_em)}</span>
                    </div>
                    <p className="mt-2 break-all text-ink">{p.whatsapp ?? p.email}</p>
                    {p.site && (
                      <a href={p.site} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-block text-forest underline">
                        Ver portfólio/site
                      </a>
                    )}
                    <div className="mt-3"><StatusInteresse id={p.id} status={p.status} /></div>
                  </li>
                ))}
              </ul>
              {/* Computador: tabela */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-sage-200 text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Nome</th>
                      <th className="py-2 pr-3 font-medium">Tipo</th>
                      <th className="py-2 pr-3 font-medium">Cidade</th>
                      <th className="py-2 pr-3 font-medium">Contato</th>
                      <th className="py-2 pr-3 font-medium">Data</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sage-100">
                    {interesses.map((p) => (
                      <tr key={p.id} className="align-middle">
                        <td className="py-2.5 pr-3 font-semibold text-ink">
                          {p.nome}
                          {p.site && (
                            <a href={p.site} target="_blank" rel="noopener noreferrer nofollow" className="ml-2 text-xs font-normal text-forest underline">site</a>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-muted">{rotuloTipo(p.tipo)}</td>
                        <td className="py-2.5 pr-3 text-muted">{p.cidade}/{p.uf}</td>
                        <td className="py-2.5 pr-3 break-all text-ink">{p.whatsapp ?? p.email}</td>
                        <td className="py-2.5 pr-3 text-muted">{dataBR(p.criado_em)}</td>
                        <td className="py-2.5"><StatusInteresse id={p.id} status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
