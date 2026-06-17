"use client";

import { useAuthStore } from "@/lib/store";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { TaxSimulator } from "@/components/tax-simulator";

export default function AccountPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Conta" subtitle="Seus dados pessoais e preferências." />

      <Panel title="Dados pessoais">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo" defaultValue={user?.name ?? ""} />
          <Field label="E-mail" defaultValue={user?.email ?? ""} type="email" />
          <Field label="Telefone" placeholder="(34) 90000-0000" />
          <Field label="Perfil" defaultValue={roleLabel(user?.role)} readOnly />
        </div>
        <div className="mt-6">
          <Button>Salvar alterações</Button>
        </div>
      </Panel>

      {user?.role !== "tenant" && (
        <div className="mt-6">
          <h2 className="mb-3 font-title text-lg font-bold text-ink">Tributação dos aluguéis</h2>
          <TaxSimulator />
        </div>
      )}

      <Panel title="Verificação" className="mt-6">
        <p className="text-sm text-muted">
          Complete a verificação de identidade para gerar mais confiança. Progresso atual:{" "}
          <strong className="text-forest">60%</strong>.
        </p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-sage-100">
          <div className="h-full w-[60%] rounded-full bg-champagne" />
        </div>
        <Button variant="outline" className="mt-5">
          Continuar verificação
        </Button>
      </Panel>
    </div>
  );
}

function roleLabel(role?: string) {
  if (role === "owner") return "Proprietário";
  if (role === "tenant") return "Inquilino";
  if (role === "admin") return "Administrador";
  return "—";
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-sage-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sage read-only:bg-surface-2 read-only:text-muted"
      />
    </label>
  );
}
