import { NumeroDaFonte } from "@/components/admin/numero-da-fonte";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ListaNumeros, NumeroHeroi } from "@/components/admin/numeros";
import { Button, ButtonLink } from "@/components/ui/button";
import { SeloTeste } from "@/components/admin/selo-teste";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { estadosIdentidade } from "@/lib/identidade/estado-servidor";
import { idsContasTeste } from "@/lib/data/admin-indicadores";
import { tipoImovel } from "@/lib/admin/indicadores";
import { dataBRT } from "@/lib/datas-brasilia";
import { cadastroCompleto, faltaNoCadastro, filtrosUsuarios, hrefUsuarios, rotuloFiltroUsuarios, type DadosCadastro } from "@/lib/admin/usuarios-lista";
import { Users } from "lucide-react";
import { BotaoContaTeste } from "./conta-teste";
import { rotuloDoAdmin, tituloDoAdmin } from "@/config/menu-admin";

export const metadata = { title: tituloDoAdmin("/admin/usuarios"), robots: { index: false, follow: false } };

const LIMITE = 200;
const PAPEL: Record<string, string> = { owner: "Proprietário", tenant: "Inquilino", admin: "Admin" };

type Linha = {
  id: string;
  full_name: string | null;
  role: string;
  created_at: string;
  fundador: boolean | null;
  is_teste: boolean | null;
  avatar_url: string | null;
  cpf: string | null;
  cnpj: string | null;
};

/**
 * Lista que os cartões da visão geral abrem (ordem 61454243 + Prompt 29). Mesmo critério do número da home:
 * perfis não anonimizados com papel de dono ou inquilino, contas de teste fora (filtro "Mostrar contas de teste").
 * O admin aparece com "Papel: admin". Cadastro completo = a MESMA função da Conta. Sem CPF, telefone ou e-mail na tela.
 */
export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const um = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const f = filtrosUsuarios({
    papel: um("papel"),
    fundador: um("fundador"),
    desde: um("desde"),
    de: um("de"),
    ate: um("ate"),
    cadastro: um("cadastro"),
    q: um("q"),
    com_anuncio: um("com_anuncio"),
    teste: um("teste"),
  });

  const supabase = await createClient();
  const admin = createAdminClient();
  let linhas: (Linha & { completo: boolean; falta: string })[] = [];
  let total = 0;
  const foneVerificado = new Map<string, boolean>();
  let identidade = new Map<string, { texto: string; validoAte: string | null }>();
  if (supabase && admin) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !(await ehAdmin(supabase, user.id))) notFound();
    let q = admin
      .from("profiles")
      .select("id, full_name, role, created_at, fundador, is_teste, avatar_url, cpf, cnpj")
      .order("created_at", { ascending: false })
      .limit(2000);
    // Fundadores conta como o cartão: qualquer perfil com fundador, sem filtro de papel.
    if (f.fundador) q = q.eq("fundador", true);
    if (!f.fundador) q = q.is("anonymized_at", null).in("role", f.papel ? [f.papel] : ["owner", "tenant"]);
    if (f.fundador && f.papel) q = q.eq("role", f.papel);
    if (!f.teste) q = q.or("is_teste.is.null,is_teste.eq.false");
    if (f.q) q = q.ilike("full_name", `%${f.q}%`);
    if (f.desde) q = q.gte("created_at", `${f.desde}T00:00:00-03:00`);
    if (f.ate) q = q.lt("created_at", new Date(new Date(`${f.ate}T00:00:00-03:00`).getTime() + 86_400_000).toISOString());
    const [{ data }, confirmados, comAnuncio] = await Promise.all([q, emailsConfirmados(admin), f.comAnuncio ? donosComAnuncio(admin) : Promise.resolve(null)]);
    let todas = ((data ?? []) as Linha[]).map((l) => {
      const d: DadosCadastro = { nome: l.full_name, emailConfirmado: confirmados.has(l.id), cpf: l.cpf, cnpj: l.cnpj, foto: !!l.avatar_url };
      return { ...l, completo: cadastroCompleto(d), falta: faltaNoCadastro(d) };
    });
    if (comAnuncio) todas = todas.filter((l) => comAnuncio.has(l.id));
    if (f.cadastro === "completo") todas = todas.filter((l) => l.completo);
    if (f.cadastro === "incompleto") todas = todas.filter((l) => !l.completo);
    total = todas.length;
    linhas = todas.slice(0, LIMITE);
    if (linhas.length > 0) {
      const ids = linhas.map((l) => l.id);
      const [{ data: fs, error }, ests] = await Promise.all([admin.rpc("telefones_verificados", { p_ids: ids }), estadosIdentidade(admin, ids)]);
      // Telefone verificado (0150): só sim/não, pelo servidor; o número nunca sai daqui.
      if (!error) for (const x of (fs ?? []) as { id: string; verificado: boolean }[]) foneVerificado.set(x.id, x.verificado);
      identidade = new Map([...ests].map(([id, e]) => [id, { texto: e.estado === "confirmada" ? "Confirmada" : e.estado === "vencida" ? "Vencida" : "Não verificada", validoAte: e.validoAte }]));
    }
  }
  const idText = (id: string) => {
    const e = identidade.get(id);
    if (!e) return "—";
    return e.validoAte ? `${e.texto} · laudo válido até ${dataBRT(e.validoAte)}` : e.texto;
  };

  return (
    <>
      <PageTitle
        title={rotuloDoAdmin("/admin/usuarios")}
        subtitle={rotuloFiltroUsuarios(f)}
        action={
          <Link href="/admin" className="text-sm text-forest underline">
            Voltar à visão geral
          </Link>
        }
      />
      <NumeroDaFonte chave="usuarios" />
      <NumeroHeroi rotulo="Usuários nesta lista" valor={total} href="#lista" />
      <ListaNumeros
        className="mb-6"
        itens={[
          { rotulo: "Proprietários", valor: "Ver lista", href: hrefUsuarios({ papel: "proprietario" }) },
          { rotulo: "Inquilinos", valor: "Ver lista", href: hrefUsuarios({ papel: "inquilino" }) },
          { rotulo: "Admins", valor: "Ver lista", href: hrefUsuarios({ papel: "admin" }) },
        ]}
      />
      <form action="/admin/usuarios" method="get" className="mb-4 flex flex-wrap items-end gap-2" role="search">
        {f.fundador && <input type="hidden" name="fundador" value="1" />}
        {f.comAnuncio && <input type="hidden" name="com_anuncio" value="1" />}
        {f.desde && <input type="hidden" name="desde" value={f.desde} />}
        {f.ate && <input type="hidden" name="ate" value={f.ate} />}
        <label className="grid flex-1 gap-1 text-sm text-muted sm:max-w-xs">
          Buscar por nome
          <input name="q" defaultValue={f.q ?? ""} maxLength={60} className="rounded-xl border border-line px-3 py-2 text-ink" />
        </label>
        <label className="grid gap-1 text-sm text-muted">
          Papel
          <select
            name="papel"
            defaultValue={f.papel === "owner" ? "proprietario" : f.papel === "tenant" ? "inquilino" : f.papel === "admin" ? "admin" : ""}
            className="rounded-xl border border-line px-3 py-2 text-ink"
            data-testid="filtro-papel"
          >
            <option value="">Proprietários e inquilinos</option>
            <option value="proprietario">Proprietário</option>
            <option value="inquilino">Inquilino</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm text-muted">
          Cadastro
          <select name="cadastro" defaultValue={f.cadastro ?? ""} className="rounded-xl border border-line px-3 py-2 text-ink">
            <option value="">Todos</option>
            <option value="completo">Completo</option>
            <option value="incompleto">Incompleto</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm text-muted">
          Mostrar contas de teste
          <select name="teste" defaultValue={f.teste ? "sim" : ""} className="rounded-xl border border-line px-3 py-2 text-ink" data-testid="filtro-teste">
            <option value="">Não</option>
            <option value="sim">Sim</option>
          </select>
        </label>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
      </form>
      <p className="mb-3 text-xs text-muted">
        Cadastro completo = nome + e-mail confirmado + documento (CPF ou CNPJ) + foto, a mesma regra da Conta. Telefone verificado fica &quot;Não&quot;
        enquanto a verificação por SMS não estiver ligada; a identidade confirmada é a coluna Identidade. Uma conta marcada como teste
        some desta lista enquanto &quot;Mostrar contas de teste&quot; estiver em &quot;Não&quot;.
      </p>
      <Panel title={`Usuários (${total})`} data-testid="admin-usuarios-lista" id="lista" className="scroll-mt-24">
        {linhas.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum usuário nesta lista" text="Tire o filtro para ver todos." action={<ButtonLink href="/admin/usuarios" variant="secondary" size="sm">Ver todos os usuários</ButtonLink>} />
        ) : (
          <>
            <ul className="grid gap-3 sm:hidden">
              {linhas.map((u) => (
                <li key={u.id} className="rounded-xl border border-line p-3" data-usuario data-papel={u.role}>
                  <p className="font-semibold text-ink">
                    {u.full_name?.trim() || "Sem nome"}
                    {u.is_teste && <SeloTeste />}
                  </p>
                  <p className="text-sm text-muted">
                    {PAPEL[u.role] ?? u.role}
                    {u.fundador ? " · Fundador" : ""} · cadastro {u.completo ? "completo" : `incompleto (falta: ${u.falta})`} · identidade: {idText(u.id)} ·
                    telefone verificado: {foneVerificado.get(u.id) ? "sim" : "não"} · desde {dataBRT(u.created_at)}
                  </p>
                  {u.role !== "admin" && (
                    <div className="mt-2">
                      <BotaoContaTeste id={u.id} isTeste={!!u.is_teste} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">Nome</th>
                    <th className="py-2 pr-4 font-semibold">Papel</th>
                    <th className="py-2 pr-4 font-semibold">Fundador</th>
                    <th className="py-2 pr-4 font-semibold">Cadastro completo</th>
                    <th className="py-2 pr-4 font-semibold">Identidade</th>
                    <th className="py-2 pr-4 font-semibold">Telefone verificado</th>
                    <th className="py-2 pr-4 font-semibold">Cadastro</th>
                    <th className="py-2 font-semibold">Conta de teste</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((u) => (
                    <tr key={u.id} className="border-t border-line" data-usuario data-papel={u.role}>
                      <td className="py-2 pr-4 text-ink">
                        {u.full_name?.trim() || "Sem nome"}
                        {u.is_teste && <SeloTeste />}
                      </td>
                      <td className="py-2 pr-4">{PAPEL[u.role] ?? u.role}</td>
                      <td className="py-2 pr-4">{u.fundador ? "Sim" : "—"}</td>
                      <td className="py-2 pr-4" data-testid="admin-cadastro-completo" title={u.falta ? `Falta: ${u.falta}` : undefined}>
                        {u.completo ? "Sim" : "Não"}
                      </td>
                      <td className="py-2 pr-4" data-testid="admin-identidade">{idText(u.id)}</td>
                      <td className="py-2 pr-4" data-testid="admin-telefone-verificado">{foneVerificado.get(u.id) ? "Sim" : "Não"}</td>
                      <td className="py-2 pr-4">{dataBRT(u.created_at)}</td>
                      <td className="py-2">{u.role !== "admin" ? <BotaoContaTeste id={u.id} isTeste={!!u.is_teste} /> : "—"}</td>
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

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Ids com e-mail confirmado (auth.users.email_confirmed_at), lidos pelo servidor. */
async function emailsConfirmados(admin: Admin): Promise<Set<string>> {
  const out = new Set<string>();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users) if (u.email_confirmed_at) out.add(u.id);
    if (data.users.length < 1000) break;
  }
  return out;
}

/** Donos com anúncio ATIVO e real (o mesmo critério do cartão "Donos com anúncio" da home: 0181). */
async function donosComAnuncio(admin: Admin): Promise<Set<string>> {
  const [{ data }, teste] = await Promise.all([admin.from("properties").select("id, owner_id, title").eq("status", "active").limit(5000), idsContasTeste(admin)]);
  return new Set(
    ((data ?? []) as { id: string; owner_id: string; title: string | null }[])
      .filter((p) => tipoImovel({ id: p.id, titulo: p.title, donoTeste: teste.has(p.owner_id) }) === "real")
      .map((p) => p.owner_id)
  );
}
