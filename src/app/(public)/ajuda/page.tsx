import type { Metadata } from "next";
import { CentralAjuda } from "@/components/ajuda/central-ajuda";

export const metadata: Metadata = {
  title: "Central de Ajuda",
  description: "Perguntas frequentes, abrir chamado e acompanhar seus chamados no Viva Nomads.",
  alternates: { canonical: "/ajuda" },
};

export default function AjudaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="font-title text-3xl font-bold text-ink">Central de Ajuda</h1>
      <p className="mt-2 text-muted">Respostas rápidas e, se precisar, uma pessoa da equipe.</p>
      <div className="mt-8">
        <CentralAjuda canal="site" />
      </div>
    </div>
  );
}
