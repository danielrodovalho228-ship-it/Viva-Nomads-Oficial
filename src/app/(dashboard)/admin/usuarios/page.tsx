import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTitle, Panel, StatCard, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";
import { cadastroCompleto, filtrosUsuarios, hrefUsuarios, rotuloFiltroUsuarios } from "@/lib/admin/usuarios-lista";
import { Users } from "lucide-react";

export const metadata = { title: "Usuários — Admin", robots: { index: false, follow: false } };

const LIMITE = 200;
const PAPEL: Record<string, string> = { owner: "Proprietário", tenant: "Inquilino" };

/**
 * Lista que o cartão "Usuários" da visão geral abre (ordem 61454243). Mesmo critério do número:
 * perfis não anonimizados com papel de dono ou inquilino (Fundadores: todo perfil com a marca). Sem CPF, telefone ou e-mail na lista.
 */
export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const f = filtrosUsuarios({
    papel: typeof sp.papel === "string" ? sp.papel : undefined,
    fundador: typeof sp.fundador === "string" ? sp.fundador : undefined,
    desde: typeof sp.desde === "string" ? sp.desde : undefined,
    cadastro: typeof sp.cadastro === "string" ? sp.cadastro : undefined,
    q: typeof sp.q === "string" ? sp.q : undefined,
  });

  const supabase = await createClient();
  let linhas: { id: string; full_name: string | null; role: string; created_at: string; fundador: boolean | null; phone: string | null }[] = [];
  let total = 0;
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !(await ehAdmin(supabase, user.id))) notFound();
    let q = supabase
      .from("profiles")
      .select("id, full_name, role, created_at, fundador, phone", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(LIMITE);
    // Fundadores conta como o cartão (0069:195): qualquer perfil com fundador, sem filtro de papel.
    if (f.fundador) q = q.eq("fundador", true);
    if (!f.fundador) q = q.is("anonymized_at", null).in("role", f.papel ? [f.papel] : ["owner", "tenant"]);
    if (f.fundador && f.papel) q = q.eq("role", f.papel);
    if (f.cadastro === "completo") q = q.not("full_name", "is", null).neq("full_name", "").not("phone", "is", null).neq("phone", "");
    if (f.cadastro === "incompleto") q = q.or("full_name.is.null,full_name.eq.,phone.is.null,phone.eq.");
    if (f.q) q = q.ilike("full_name", `%${f.q}%`);
    if (f.desde) q = q.gte("created_at", `${f.desde}T00:00:00-03:00`);
    const { data, count } = await q;
    linhas = data ?? [];
    total = count ?? linhas.length;
  }
  const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return (
    <>
      <PageTitle
        title="Usuários"
        subtitle={rotuloFiltroUsuarios(f)}
        action={
          <Link href="/admin" className="text-sm text-forest underline">
            Voltar à visão geral
          </Link>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Nesta lista" value={total} icon={Users} />
        <StatCard label="Proprietários" value="ver" icon={Users} href={hrefUsuarios({ papel: "proprietario" })} />
        <StatCard label="Inquilinos" value="ver" icon={Users} href={hrefUsuarios({ papel: "inquilino" })} />
        <StatCard label="Fundadores" value="ver" icon={Users} href={hrefUsuarios({ fundador: true })} />
      </div>
      <form action="/admin/usuarios" method="get" className="mb-4 flex flex-wrap items-end gap-2" role="search">
        {f.papel && <input type="hidden" name="papel" value={f.papel === "owner" ? "proprietario" : "inquilino"} />}
        {f.fundador && <input type="hidden" name="fundador" value="1" />}
        {f.desde && <input type="hidden" name="desde" value={f.desde} />}
        <label className="grid flex-1 gap-1 text-sm text-muted sm:max-w-xs">
          Buscar por nome
          <input name="q" defaultValue={f.q ?? ""} maxLength={60} className="rounded-xl border border-line px-3 py-2 text-ink" />
        </label>
        <label className="grid gap-1 text-sm text-muted">
          Cadastro
          <select name="cadastro" defaultValue={f.cadastro ?? ""} className="rounded-xl border border-line px-3 py-2 text-ink">
            <option value="">Todos</option>
            <option value="completo">Completo</option>
            <option value="incompleto">Incompleto</option>
          </select>
        </label>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
      </form>
      <Panel title={`Usuários (${total})`} data-testid="admin-usuarios-lista">
        {linhas.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum usuário nesta lista" text="Tire o filtro para ver todos." />
        ) : (
          <>
            <ul className="grid gap-3 sm:hidden">
              {linhas.map((u) => (
                <li key={u.id} className="rounded-xl border border-line p-3" data-usuario>
                  <p className="font-medium text-ink">{u.full_name?.trim() || "Sem nome"}</p>
                  <p className="text-sm text-muted">
                    {PAPEL[u.role] ?? u.role}
                    {u.fundador ? " · Fundador" : ""} · cadastro {cadastroCompleto(u) ? "completo" : "incompleto"} · desde {data(u.created_at)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Nome</th>
                    <th className="py-2 pr-4 font-medium">Papel</th>
                    <th className="py-2 pr-4 font-medium">Fundador</th>
                    <th className="py-2 pr-4 font-medium">Cadastro completo</th>
                    <th className="py-2 font-medium">Cadastro</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((u) => (
                    <tr key={u.id} className="border-t border-line" data-usuario>
                      <td className="py-2 pr-4 text-ink">{u.full_name?.trim() || "Sem nome"}</td>
                      <td className="py-2 pr-4">{PAPEL[u.role] ?? u.role}</td>
                      <td className="py-2 pr-4">{u.fundador ? "Sim" : "—"}</td>
                      <td className="py-2 pr-4">{cadastroCompleto(u) ? "Sim" : "Não"}</td>
                      <td className="py-2">{data(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > linhas.length && (
              <p className="mt-3 text-xs text-muted">
                Mostrando os {linhas.length} mais recentes de {total}.
              </p>
            )}
          </>
        )}
      </Panel>
    </>
  );
}
