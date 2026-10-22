import { dataHoraBRT } from "@/lib/datas-brasilia";
import { Mail, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Panel, StatCard, EmptyState } from "@/components/dashboard/primitives";
import { LISTA_MAX } from "@/lib/notifications/caixa-teste";

export const metadata = { title: "E-mails de teste — Admin" };
export const dynamic = "force-dynamic";

interface Linha {
  id: string;
  criado_em: string;
  evento: string;
  assunto: string;
  corpo: string;
  destinatario_mascarado: string;
}

const quando = (iso: string) =>
  dataHoraBRT(iso, { tabela: true });

/** Admin → E-mails de teste: o que o sistema enviou às contas de teste, para o QA ler sem encaminhamento manual. */
export default async function AdminEmailsTestePage() {
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase.from("emails_teste").select("id, criado_em, evento, assunto, corpo, destinatario_mascarado").order("criado_em", { ascending: false }).limit(LISTA_MAX)
    : { data: null };
  const linhas = (data ?? []) as Linha[];

  return (
    <div data-testid="emails-teste">
      <PageTitle title="E-mails de teste" subtitle="Tudo o que o sistema enviou às contas de teste. Só texto puro, destinatário mascarado." />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-4">
        <StatCard label="Guardados (últimos 100)" value={linhas.length} icon={Mail} />
        <StatCard label="Último recebido" value={linhas[0] ? quando(linhas[0].criado_em) : "—"} icon={Clock} />
      </div>
      <Panel title="Mais recentes primeiro">
        {linhas.length === 0 ? (
          <EmptyState icon={Mail} title="Nenhum e-mail de teste ainda" text="Quando uma conta de teste receber um e-mail do sistema, ele aparece aqui." />
        ) : (
          <>
            {/* Celular: cartões */}
            <ul className="space-y-3 md:hidden" data-testid="emails-teste-cartoes">
              {linhas.map((l) => (
                <li key={l.id} className="min-w-0 rounded-xl border border-sage-200 p-3">
                  <p className="text-xs text-muted">
                    {quando(l.criado_em)} · {l.destinatario_mascarado}
                  </p>
                  <p className="mt-1 break-words font-medium text-ink">{l.assunto}</p>
                  <details className="mt-2">
                    <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-forest">Ler o e-mail</summary>
                    <pre className="whitespace-pre-wrap break-words text-sm text-ink">{l.corpo}</pre>
                  </details>
                </li>
              ))}
            </ul>
            {/* Computador: tabela */}
            <div className="hidden md:block">
              <table className="w-full table-fixed text-left text-sm" data-testid="emails-teste-tabela">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="w-32 py-2">Quando</th>
                    <th className="w-44 py-2">Para</th>
                    <th className="py-2">Assunto e texto</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.id} className="border-t border-sage-200 align-top">
                      <td className="py-2 pr-2">{quando(l.criado_em)}</td>
                      <td className="break-words py-2 pr-2">{l.destinatario_mascarado}</td>
                      <td className="py-2">
                        <details>
                          <summary className="cursor-pointer break-words font-medium text-ink">{l.assunto}</summary>
                          <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-ink">{l.corpo}</pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
