import { dataHoraBRT } from "@/lib/datas-brasilia";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ListaNumeros, NumeroHeroi } from "@/components/admin/numeros";
import { ListaEmailsTeste } from "@/components/admin/lista-emails-teste";
import { LISTA_MAX, type LinhaEmailTeste } from "@/lib/notifications/caixa-teste";
import { contarEmailsTeste } from "@/lib/data/admin-contagens";

const quando = (iso: string) =>
  dataHoraBRT(iso, { tabela: true });

/**
 * E-mails de teste: o que o sistema enviou às contas de teste, para o QA ler sem encaminhamento manual. ADMIN-2: é a aba
 * "E-mails" de /admin/dados-de-teste (/admin/emails-teste redireciona para ela). A lista é a mesma do leitor de QA
 * (/dashboard/qa/emails, QA-CAIXA-B): `ListaEmailsTeste`, sempre mascarada.
 */
export async function EmailsTesteLista() {
  const supabase = await createClient();
  // ADMIN-4 (E128): o número é o total exato da tabela (mesma função da contagem do admin), não o tamanho da lista.
  const [{ data }, total] = supabase
    ? await Promise.all([
        supabase.from("emails_teste").select("id, criado_em, evento, assunto, corpo, destinatario_mascarado").order("criado_em", { ascending: false }).limit(LISTA_MAX),
        contarEmailsTeste(supabase).catch(() => null),
      ])
    : [{ data: null }, null];
  const linhas = (data ?? []) as LinhaEmailTeste[];

  return (
    <div data-testid="emails-teste">
      <p className="mb-4 text-sm text-muted">Tudo o que o sistema enviou às contas de teste. Só texto puro, destinatário mascarado.</p>
      <NumeroHeroi rotulo="E-mails de teste guardados" valor={total ?? linhas.length} href="#lista" nota={total !== null && total > linhas.length ? `A lista mostra os ${linhas.length} mais recentes.` : null} testId="emails-teste-total" />
      <ListaNumeros className="mb-6" itens={[{ rotulo: "Último recebido", valor: linhas[0] ? quando(linhas[0].criado_em) : "—", href: "#lista" }]} />
      <ListaEmailsTeste
        linhas={linhas}
        vazio={{ titulo: "Nenhum e-mail de teste ainda", texto: "Quando uma conta de teste receber um e-mail do sistema, ele aparece aqui.", acao: <ButtonLink href="/admin/dados-de-teste" variant="secondary" size="sm">Abrir a aba Dados</ButtonLink> }}
      />
    </div>
  );
}
