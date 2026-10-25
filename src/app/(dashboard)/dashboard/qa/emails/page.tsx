import { notFound } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/dashboard/primitives";
import { ListaEmailsTeste } from "@/components/admin/lista-emails-teste";
import { filtroQaDaUrl, LISTA_MAX, opcoesFiltroQa, podeLerCaixasQa, type LinhaEmailTeste } from "@/lib/notifications/caixa-teste";

export const metadata = { title: "E-mails das contas de teste" };
export const dynamic = "force-dynamic";

/** Quantas linhas leves (conta, destinatário mascarado, evento) montam as opções dos filtros. */
const OPCOES_MAX = 2000;

/**
 * QA-CAIXA-B — leitor de QA: todas as caixas de teste, fora de /admin (sem admin e sem 2FA).
 * Só abre para conta de teste com qa_leitor (migração 0246, só o servidor liga); as demais recebem 404.
 * A leitura usa a sessão da pessoa: quem barra de verdade é a RLS (política emails_teste_qa_leitor_le).
 */
export default async function QaEmailsPage({ searchParams }: { searchParams: Promise<{ conta?: string | string[]; evento?: string | string[] }> }) {
  const supabase = await createClient();
  if (!supabase) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: perfil } = await supabase.from("profiles").select("qa_leitor, is_teste").eq("id", user.id).maybeSingle();
  if (!podeLerCaixasQa(perfil)) notFound();

  const { data: leves } = await supabase.from("emails_teste").select("usuario_id, destinatario_mascarado, evento").order("criado_em", { ascending: false }).limit(OPCOES_MAX);
  const opcoes = opcoesFiltroQa((leves ?? []) as { usuario_id: string | null; destinatario_mascarado: string; evento: string }[]);
  const filtro = filtroQaDaUrl(await searchParams, opcoes);

  let consulta = supabase.from("emails_teste").select("id, criado_em, evento, assunto, corpo, destinatario_mascarado");
  if (filtro.conta) consulta = consulta.eq("usuario_id", filtro.conta);
  if (filtro.evento) consulta = consulta.eq("evento", filtro.evento);
  const { data } = await consulta.order("criado_em", { ascending: false }).limit(LISTA_MAX);
  const linhas = (data ?? []) as LinhaEmailTeste[];
  const filtrando = Boolean(filtro.conta || filtro.evento);
  const campo = "w-full min-w-0 max-w-full rounded-lg border border-sage-200 bg-white px-2 py-2";

  return (
    <div data-testid="qa-emails">
      <PageTitle title="E-mails das contas de teste" subtitle={`Todas as caixas de teste, mais recentes primeiro (até ${LISTA_MAX}). Só texto puro, e-mails mascarados.`} />
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
        linhas={linhas}
        titulo={filtrando ? "Resultado do filtro" : "Mais recentes primeiro"}
        vazio={filtrando ? { titulo: "Nenhum e-mail com esse filtro", texto: "Troque a conta ou o evento, ou limpe o filtro." } : { titulo: "Nenhum e-mail de teste ainda", texto: "Quando uma conta de teste receber um e-mail do sistema, ele aparece aqui." }}
      />
    </div>
  );
}
