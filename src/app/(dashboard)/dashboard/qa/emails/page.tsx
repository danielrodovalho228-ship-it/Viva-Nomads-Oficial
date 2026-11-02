import { notFound, redirect } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/dashboard/primitives";
import { ListaEmailsTeste } from "@/components/admin/lista-emails-teste";
import { destinoLeitorQa, faixaDaPagina, filtroQaDaUrl, opcoesFiltroQa, paginaDaUrl, POR_PAGINA, totalDePaginas, type LinhaEmailTeste } from "@/lib/notifications/caixa-teste";

export const metadata = { title: "E-mails das contas de teste" };
export const dynamic = "force-dynamic";

/** Quantas linhas leves (conta, destinatário mascarado, evento) montam as opções dos filtros. */
const OPCOES_MAX = 2000;

/**
 * QA-CAIXA-B — leitor de QA: todas as caixas de teste, fora de /admin (sem admin e sem 2FA).
 * Só abre para conta de teste com qa_leitor (migração 0246, só o servidor liga); as demais recebem 404.
 * A leitura usa a sessão da pessoa: quem barra de verdade é a RLS (política emails_teste_qa_leitor_le).
 */
export default async function QaEmailsPage({ searchParams }: { searchParams: Promise<{ conta?: string | string[]; evento?: string | string[]; pagina?: string | string[] }> }) {
  const supabase = await createClient();
  if (!supabase) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: perfil } = await supabase.from("profiles").select("qa_leitor, is_teste, role").eq("id", user.id).maybeSingle();
  // E199: o admin vai para a lista dele (aba E-mails de /admin/dados-de-teste); quem não é leitor de QA recebe 404.
  const destino = destinoLeitorQa(perfil);
  if (destino.tipo === "admin") redirect(destino.href);
  // E354: conta de teste sem qa_leitor → a caixa dela; conta real → 404.
  if (destino.tipo === "propria") redirect(destino.href);
  if (destino.tipo !== "abre") notFound();

  const { data: leves } = await supabase.from("emails_teste").select("usuario_id, destinatario_mascarado, evento").order("criado_em", { ascending: false }).limit(OPCOES_MAX);
  const opcoes = opcoesFiltroQa((leves ?? []) as { usuario_id: string | null; destinatario_mascarado: string; evento: string }[]);
  const sp = await searchParams;
  const filtro = filtroQaDaUrl(sp, opcoes);
  // E435: paginação — antes só os 100 mais recentes apareciam (213 guardados no QA de 02/11).
  const pagina = paginaDaUrl(sp.pagina);
  const { de, ate } = faixaDaPagina(pagina);

  // E435: o leitor de QA vê também a versão HTML, o destinatário por extenso e o link de descadastro.
  let consulta = supabase.from("emails_teste").select("id, criado_em, evento, assunto, corpo, destinatario_mascarado, html, destinatario, descadastro_url", { count: "exact" });
  if (filtro.conta) consulta = consulta.eq("usuario_id", filtro.conta);
  if (filtro.evento) consulta = consulta.eq("evento", filtro.evento);
  const { data, count } = await consulta.order("criado_em", { ascending: false }).range(de, ate);
  const linhas = (data ?? []) as LinhaEmailTeste[];
  const paginas = totalDePaginas(count);
  const hrefPagina = (n: number) => {
    const q = new URLSearchParams();
    if (filtro.conta) q.set("conta", filtro.conta);
    if (filtro.evento) q.set("evento", filtro.evento);
    if (n > 1) q.set("pagina", String(n));
    const s = q.toString();
    return s ? `/dashboard/qa/emails?${s}` : "/dashboard/qa/emails";
  };
  const navegacao =
    paginas > 1 ? (
      <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Páginas" data-testid="qa-emails-paginas">
        <span className="text-muted">
          Página {pagina} de {paginas} · {count ?? 0} e-mails
        </span>
        <span className="flex gap-2">
          {pagina > 1 && <ButtonLink href={hrefPagina(pagina - 1)} variant="secondary" size="sm">Mais recentes</ButtonLink>}
          {pagina < paginas && <ButtonLink href={hrefPagina(pagina + 1)} variant="secondary" size="sm" data-testid="qa-emails-proxima">Mais antigos</ButtonLink>}
        </span>
      </nav>
    ) : null;
  const filtrando = Boolean(filtro.conta || filtro.evento);
  const campo = "w-full min-w-0 max-w-full rounded-lg border border-sage-200 bg-white px-2 py-2";

  return (
    <div data-testid="qa-emails">
      <PageTitle title="E-mails das contas de teste" subtitle={`Todas as caixas de teste, mais recentes primeiro (${POR_PAGINA} por página). Texto, versão HTML, destinatário e link de descadastro.`} />
      <form method="get" className="mb-6 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end" data-testid="qa-emails-filtros">
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-semibold text-ink">Conta de teste</span>
          <select name="conta" defaultValue={filtro.conta ?? ""} className={campo} data-testid="qa-emails-conta">
            <option value="">Todas as contas</option>
            {opcoes.contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-semibold text-ink">Evento</span>
          <select name="evento" defaultValue={filtro.evento ?? ""} className={campo} data-testid="qa-emails-evento">
            <option value="">Todos os eventos</option>
            {opcoes.eventos.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <Button type="submit" size="sm">Filtrar</Button>
          {filtrando ? (
            <ButtonLink href="/dashboard/qa/emails" variant="secondary" size="sm">Limpar</ButtonLink>
          ) : null}
        </div>
      </form>
      <ListaEmailsTeste
        qa
        rodape={navegacao}
        linhas={linhas}
        titulo={filtrando ? "Resultado do filtro" : "Mais recentes primeiro"}
        vazio={filtrando ? { titulo: "Nenhum e-mail com esse filtro", texto: "Troque a conta ou o evento, ou limpe o filtro." } : { titulo: "Nenhum e-mail de teste ainda", texto: "Quando uma conta de teste receber um e-mail do sistema, ele aparece aqui." }}
      />
    </div>
  );
}
