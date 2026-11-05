import { Button, ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ListaEmailsTeste } from "@/components/admin/lista-emails-teste";
import { faixaDaPagina, hrefDaCaixa, filtroQaDaUrl, opcoesFiltroQa, paginaDaUrl, POR_PAGINA, totalDePaginas, type LinhaEmailTeste } from "@/lib/notifications/caixa-teste";

/** Quantas linhas leves (conta, destinatário mascarado, evento) montam as opções dos filtros. */
const OPCOES_MAX = 2000;

export type ParamsCaixaQa = { conta?: string | string[]; evento?: string | string[]; pagina?: string | string[] };

/**
 * E435 — a caixa das contas de teste com filtro, paginação, versão HTML, destinatário por extenso e descadastro.
 * A MESMA em /dashboard/qa/emails (leitor de QA) e na aba E-mails de /admin/dados-de-teste (admin). Reteste de 04/11:
 * a conta do QA é admin, e o admin era levado para a lista antiga (100 mais recentes, só texto, mascarada), que nunca
 * recebeu a correção do E435. A leitura usa a sessão da pessoa: quem barra é a RLS (emails_teste_admin_le e
 * emails_teste_qa_leitor_le).
 */
export async function CaixaEmailsQa({ sp, base, fixos = {}, testId = "qa-emails" }: { sp: ParamsCaixaQa; base: string; fixos?: Record<string, string>; testId?: string }) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: leves } = await supabase.from("emails_teste").select("usuario_id, destinatario_mascarado, evento").order("criado_em", { ascending: false }).limit(OPCOES_MAX);
  const opcoes = opcoesFiltroQa((leves ?? []) as { usuario_id: string | null; destinatario_mascarado: string; evento: string }[]);
  const filtro = filtroQaDaUrl(sp, opcoes);
  // E435: paginação — antes só os 100 mais recentes apareciam (213 guardados no QA de 02/11; 243 no reteste de 04/11).
  const pagina = paginaDaUrl(sp.pagina);
  const { de, ate } = faixaDaPagina(pagina);

  // E435: a versão HTML, o destinatário por extenso e o link de descadastro.
  let consulta = supabase.from("emails_teste").select("id, criado_em, evento, assunto, corpo, destinatario_mascarado, html, destinatario, descadastro_url", { count: "exact" });
  if (filtro.conta) consulta = consulta.eq("usuario_id", filtro.conta);
  if (filtro.evento) consulta = consulta.eq("evento", filtro.evento);
  const { data, count } = await consulta.order("criado_em", { ascending: false }).range(de, ate);
  const linhas = (data ?? []) as LinhaEmailTeste[];
  const paginas = totalDePaginas(count);
  const hrefPagina = (n: number) => hrefDaCaixa(base, fixos, { conta: filtro.conta, evento: filtro.evento, pagina: n });
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
    <div data-testid={testId}>
      <p className="mb-4 text-sm text-muted">
        Todas as caixas de teste, mais recentes primeiro ({POR_PAGINA} por página). Texto, versão HTML, destinatário e link de descadastro. A versão HTML existe para os e-mails guardados a partir de 02/11.
      </p>
      <form method="get" action={base} className="mb-6 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end" data-testid="qa-emails-filtros">
        {Object.entries(fixos).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
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
            <ButtonLink href={hrefDaCaixa(base, fixos, {})} variant="secondary" size="sm">Limpar</ButtonLink>
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
