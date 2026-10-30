import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { conferirDescadastro } from "@/lib/notifications/proativos";
import { desligarSugestoes } from "./acao";

export const metadata: Metadata = { title: "Não quero mais este tipo de e-mail", robots: { index: false, follow: false } };

/**
 * E264-B — link "Não quero mais este tipo de e-mail" dos e-mails proativos: confirma e desliga SÓ a categoria
 * "Sugestões e novidades". Sem login (vale a assinatura do link). A confirmação evita que um leitor de links do
 * provedor desligue sem querer; o one-click do provedor usa o POST de /api/avisos/desligar.
 */
export default async function DesligarSugestoesPage({ searchParams }: { searchParams: Promise<{ u?: string; t?: string; ok?: string }> }) {
  const { u = "", t = "", ok } = await searchParams;
  const valido = conferirDescadastro(u, t, process.env.CRON_SECRET ?? "");
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-ink">Sugestões e novidades por e-mail</h1>
      {ok === "1" ? (
        <p className="mt-4 text-muted" data-testid="sugestoes-desligadas">
          Pronto: você não recebe mais e-mails de sugestões e novidades (imóveis novos para o seu pedido ou busca e pedidos que combinam com o seu imóvel). Decisões, mensagens e avisos da sua estadia continuam chegando. Você pode religar em{" "}
          <Link href="/dashboard/notificacoes" className="font-medium text-forest underline">
            Notificações
          </Link>
          .
        </p>
      ) : valido ? (
        <form action={desligarSugestoes} className="mt-4 grid gap-4">
          <p className="text-muted">
            Você deixa de receber e-mails de sugestões e novidades. Decisões, mensagens e avisos da sua estadia continuam chegando.
          </p>
          <input type="hidden" name="u" value={u} />
          <input type="hidden" name="t" value={t} />
          <Button type="submit" data-testid="sugestoes-desligar">
            Não quero mais este tipo de e-mail
          </Button>
        </form>
      ) : (
        <p className="mt-4 text-muted" role="alert">
          Este link não é válido. Entre em{" "}
          <Link href="/dashboard/notificacoes" className="font-medium text-forest underline">
            Notificações
          </Link>{" "}
          para escolher o que receber.
        </p>
      )}
    </main>
  );
}
