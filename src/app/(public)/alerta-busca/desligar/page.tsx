import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { conferirDesligarAlerta } from "@/lib/busca/alerta-busca";
import { desligarAlertaPorLink } from "./acao";

export const metadata: Metadata = { title: "Desligar alerta de busca", robots: { index: false, follow: false } };

/** Link do e-mail de alerta (ordem cb9a09e9): confirma e desliga SÓ o alerta daquela busca. Sem login. */
export default async function DesligarAlertaPage({ searchParams }: { searchParams: Promise<{ b?: string; t?: string; ok?: string }> }) {
  const { b = "", t = "", ok } = await searchParams;
  const valido = conferirDesligarAlerta(b, t, process.env.CRON_SECRET ?? "");
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-ink">Desligar alerta de busca</h1>
      {ok === "1" ? (
        <p className="mt-4 text-muted" data-testid="alerta-desligado">
          Pronto: você não recebe mais avisos desta busca. Ela continua salva em <Link href="/dashboard/buscas" className="font-medium text-forest underline">Buscas salvas</Link>, onde você pode religar o alerta quando quiser.
        </p>
      ) : valido ? (
        <form action={desligarAlertaPorLink} className="mt-4 grid gap-4">
          <p className="text-muted">Você deixa de receber e-mails de novos imóveis desta busca. As outras buscas não mudam.</p>
          <input type="hidden" name="b" value={b} />
          <input type="hidden" name="t" value={t} />
          <Button type="submit">Desligar este alerta</Button>
        </form>
      ) : (
        <p className="mt-4 text-muted" role="alert">Este link não é válido. Entre em <Link href="/dashboard/buscas" className="font-medium text-forest underline">Buscas salvas</Link> para gerenciar seus alertas.</p>
      )}
    </main>
  );
}
