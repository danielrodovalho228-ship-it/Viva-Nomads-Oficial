import { notFound } from "next/navigation";
import { safeInternalPath } from "@/lib/safe-redirect";
import { emailNormalizado } from "@/lib/qa/entrar";
import { qaLoginLigado } from "@/lib/qa/entrar-servidor";
import { QaEntrarForm } from "./qa-entrar-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrada da QA", robots: { index: false, follow: false } };

/*
  QA-LOGIN-B — atalho da QA: /qa/entrar?email=…&destino=/dashboard. A chave é pedida num campo de senha e vai no
  corpo do POST para /api/qa/entrar; NUNCA pela URL. Sem QA_LOGIN_KEY_HASH a página não existe, e uma URL que traga a
  chave (?chave= ou ?key=) também dá 404: a chave já vazou para o histórico e não é usada.
*/
export default async function QaEntrarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!qaLoginLigado()) notFound();
  const sp = await searchParams;
  if ("chave" in sp || "key" in sp) notFound();
  const email = emailNormalizado(typeof sp.email === "string" ? sp.email : "");
  const destino = safeInternalPath(typeof sp.destino === "string" ? sp.destino : null);
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="font-title text-xl font-semibold text-ink">Entrada da QA</h1>
        <p className="mt-1 text-sm text-muted">Só para contas de teste. Nenhum e-mail é enviado.</p>
        <QaEntrarForm email={email} destino={destino} />
      </div>
    </div>
  );
}
