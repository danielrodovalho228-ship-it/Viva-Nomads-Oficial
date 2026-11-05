import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/dashboard/primitives";
import { CaixaEmailsQa, type ParamsCaixaQa } from "@/components/admin/caixa-emails-qa";
import { destinoLeitorQa } from "@/lib/notifications/caixa-teste";

export const metadata = { title: "E-mails das contas de teste" };
export const dynamic = "force-dynamic";

/**
 * QA-CAIXA-B — leitor de QA: todas as caixas de teste, fora de /admin (sem admin e sem 2FA).
 * Só abre para conta de teste com qa_leitor (migração 0246, só o servidor liga); as demais recebem 404.
 * A leitura usa a sessão da pessoa: quem barra de verdade é a RLS (política emails_teste_qa_leitor_le).
 * E435: a caixa (filtro, paginação, HTML, destinatário, descadastro) é a MESMA da aba E-mails do admin (CaixaEmailsQa).
 */
export default async function QaEmailsPage({ searchParams }: { searchParams: Promise<ParamsCaixaQa> }) {
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

  return (
    <div>
      <PageTitle title="E-mails das contas de teste" subtitle="Todas as caixas de teste: texto, versão HTML, destinatário e link de descadastro." />
      <CaixaEmailsQa sp={await searchParams} base="/dashboard/qa/emails" />
    </div>
  );
}
