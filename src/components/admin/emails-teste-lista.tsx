import { dataHoraBRT } from "@/lib/datas-brasilia";
import { createClient } from "@/lib/supabase/server";
import { ListaNumeros, NumeroHeroi } from "@/components/admin/numeros";
import { CaixaEmailsQa, type ParamsCaixaQa } from "@/components/admin/caixa-emails-qa";
import { contarEmailsTeste } from "@/lib/data/admin-contagens";

const quando = (iso: string) =>
  dataHoraBRT(iso, { tabela: true });

/**
 * E-mails de teste: o que o sistema enviou às contas de teste, para o QA ler sem encaminhamento manual. ADMIN-2: é a aba
 * "E-mails" de /admin/dados-de-teste (/admin/emails-teste redireciona para ela).
 * E435 (reteste de 04/11): o admin — inclusive a conta do QA — é levado para cá, e esta aba ainda mostrava a lista
 * antiga (100 mais recentes, só texto, mascarada). Agora é a MESMA caixa do leitor de QA (CaixaEmailsQa): filtro,
 * paginação, versão HTML, destinatário e descadastro.
 */
export async function EmailsTesteLista({ sp = {} }: { sp?: ParamsCaixaQa }) {
  const supabase = await createClient();
  // ADMIN-4 (E128): o número é o total exato da tabela (mesma função da contagem do admin), não o tamanho da lista.
  const [{ data: ultimo }, total] = supabase
    ? await Promise.all([
        supabase.from("emails_teste").select("criado_em").order("criado_em", { ascending: false }).limit(1).maybeSingle(),
        contarEmailsTeste(supabase).catch(() => null),
      ])
    : [{ data: null }, null];

  return (
    <div data-testid="emails-teste">
      <NumeroHeroi rotulo="E-mails de teste guardados" valor={total ?? "—"} href="#lista" testId="emails-teste-total" />
      <ListaNumeros className="mb-6" itens={[{ rotulo: "Último recebido", valor: ultimo ? quando((ultimo as { criado_em: string }).criado_em) : "—", href: "#lista" }]} />
      <CaixaEmailsQa sp={sp} base="/admin/dados-de-teste" fixos={{ aba: "emails" }} testId="admin-emails-caixa" />
    </div>
  );
}
