import { dataHoraBRT } from "@/lib/datas-brasilia";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/dashboard/primitives";
import { ListaNumeros, NumeroHeroi } from "@/components/admin/numeros";
import { ListaEmailsTeste } from "@/components/admin/lista-emails-teste";
import { LISTA_MAX, type LinhaEmailTeste } from "@/lib/notifications/caixa-teste";

export const metadata = { title: "E-mails de teste — Admin" };
export const dynamic = "force-dynamic";

const quando = (iso: string) =>
  dataHoraBRT(iso, { tabela: true });

/** Admin → E-mails de teste: o que o sistema enviou às contas de teste, para o QA ler sem encaminhamento manual. */
export default async function AdminEmailsTestePage() {
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase.from("emails_teste").select("id, criado_em, evento, assunto, corpo, destinatario_mascarado").order("criado_em", { ascending: false }).limit(LISTA_MAX)
    : { data: null };
  const linhas = (data ?? []) as LinhaEmailTeste[];

  return (
    <div data-testid="emails-teste">
      <PageTitle title="E-mails de teste" subtitle="Tudo o que o sistema enviou às contas de teste. Só texto puro, destinatário mascarado." />
      <NumeroHeroi rotulo="E-mails guardados (últimos 100)" valor={linhas.length} href="#lista" />
      <ListaNumeros className="mb-6" itens={[{ rotulo: "Último recebido", valor: linhas[0] ? quando(linhas[0].criado_em) : "—", href: "#lista" }]} />
      <ListaEmailsTeste
        linhas={linhas}
        vazio={{ titulo: "Nenhum e-mail de teste ainda", texto: "Quando uma conta de teste receber um e-mail do sistema, ele aparece aqui.", acao: <ButtonLink href="/admin/dados-de-teste" variant="secondary" size="sm">Abrir os dados de teste</ButtonLink> }}
      />
    </div>
  );
}
