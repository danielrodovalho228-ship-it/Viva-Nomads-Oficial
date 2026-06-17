import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { cn } from "@/lib/utils";

type Light = "green" | "yellow" | "red";

const LEADS: {
  name: string;
  property: string;
  profile: string;
  status: string;
  light: Light;
}[] = [
  { name: "Ana Carvalho", property: "Apto Santa Mônica", profile: "Médica · residência", status: "Nova consulta", light: "green" },
  { name: "Rafael Lima", property: "Studio Centro", profile: "Executivo em transferência", status: "Em conversa", light: "green" },
  { name: "Júlia Mendes", property: "Apto Santa Mônica", profile: "Nômade digital", status: "Aguardando verificação", light: "yellow" },
];

const LIGHT_STYLES: Record<Light, string> = {
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
};

const LIGHT_LABEL: Record<Light, string> = {
  green: "🟢 Perfil limpo",
  yellow: "🟡 Pontos de atenção",
  red: "🔴 Alto risco",
};

export default function LeadsPage() {
  return (
    <>
      <PageTitle
        title="Leads"
        subtitle="Inquilinos que demonstraram interesse nos seus imóveis."
      />

      <Panel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Inquilino</th>
                <th className="px-5 py-3 font-medium">Imóvel</th>
                <th className="px-5 py-3 font-medium">Perfil</th>
                <th className="px-5 py-3 font-medium">Análise (CAF)</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage-200">
              {LEADS.map((l) => (
                <tr key={l.name + l.property} className="hover:bg-surface-2">
                  <td className="px-5 py-4 font-medium text-ink">{l.name}</td>
                  <td className="px-5 py-4 text-muted">{l.property}</td>
                  <td className="px-5 py-4 text-muted">{l.profile}</td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        LIGHT_STYLES[l.light]
                      )}
                    >
                      {LIGHT_LABEL[l.light]}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-muted">{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
        ⚠️ A análise é informativa. A decisão de alugar é exclusivamente do proprietário — a
        plataforma nunca aprova ou reprova o inquilino.
      </p>
    </>
  );
}
