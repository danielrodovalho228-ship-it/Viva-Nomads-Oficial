import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ehAnuncioDeTeste } from "@/lib/data/anuncio-teste";
import { NovaJornadaTeste } from "./nova-jornada";

export const metadata = { title: "Dados de teste — Admin" };
export const dynamic = "force-dynamic";

/**
 * Admin → Dados de teste (prompt 28; o prompt 29 completa esta página). Tudo aqui age SÓ sobre contas is_teste e
 * anúncios [TESTE QA]. "Nova jornada de teste": candidatura nova, aceita e com documentos fictícios, pronta para o
 * Fechamento — sem apagar a candidatura nem o contrato antigos.
 */
export default async function AdminDadosDeTestePage() {
  const admin = createAdminClient();
  const { data: perfis } = admin
    ? await admin.from("profiles").select("id, full_name, email, role").eq("is_teste", true).order("email")
    : { data: null };
  const contas = (perfis ?? []) as { id: string; full_name: string | null; email: string | null; role: string | null }[];
  const idsTeste = contas.map((c) => c.id);
  const { data: props } =
    admin && idsTeste.length
      ? await admin.from("properties").select("id, title, owner_id, status").in("owner_id", idsTeste).order("created_at", { ascending: false })
      : { data: null };
  const anuncios = ((props ?? []) as { id: string; title: string | null; owner_id: string; status: string | null }[]).filter((p) => ehAnuncioDeTeste(p.title));
  const nome = new Map(contas.map((c) => [c.id, c.email ?? c.full_name ?? c.id]));

  return (
    <div data-testid="admin-dados-de-teste">
      <PageTitle title="Dados de teste" subtitle="Ações que só valem para contas de teste (is_teste) e anúncios [TESTE QA]." />
      <Panel title="Nova jornada de teste">
        {contas.length === 0 || anuncios.length === 0 ? (
          <EmptyState icon={FlaskConical} title="Faltam dados de teste" text="É preciso ao menos uma conta de inquilino de teste e um anúncio [TESTE QA] de um proprietário de teste." />
        ) : (
          <NovaJornadaTeste
            inquilinos={contas.filter((c) => c.role !== "admin").map((c) => ({ id: c.id, rotulo: c.email ?? c.full_name ?? c.id }))}
            anuncios={anuncios.map((p) => ({ id: p.id, rotulo: `${p.title ?? "Anúncio"} — ${nome.get(p.owner_id) ?? ""}`, donoId: p.owner_id }))}
          />
        )}
      </Panel>
      <p className="mt-4 text-sm text-muted">
        Caixa de e-mails das contas de teste:{" "}
        <Link href="/admin/emails-teste" className="font-medium text-forest underline">
          E-mails de teste
        </Link>
      </p>
    </div>
  );
}
