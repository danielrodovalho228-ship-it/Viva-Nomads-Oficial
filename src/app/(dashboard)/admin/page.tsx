import { ShieldCheck, Check, X } from "lucide-react";
import { PageTitle, Panel, StatCard } from "@/components/dashboard/primitives";
import { Home, Users, ClipboardList } from "lucide-react";

const PENDING = [
  { owner: "Marcos A.", property: "Apto Santa Mônica", score: 86, eligible: true },
  { owner: "Patrícia L.", property: "Studio Centro", score: 74, eligible: true },
  { owner: "Família Souza", property: "Casa Tibery", score: 52, eligible: true },
];

export default function AdminPage() {
  return (
    <>
      <PageTitle
        title="Administração"
        subtitle="Aprovar checklists, gerir imóveis e usuários."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Checklists pendentes" value={PENDING.length} icon={ClipboardList} />
        <StatCard label="Imóveis ativos" value="3" icon={Home} />
        <StatCard label="Usuários" value="28" icon={Users} />
      </div>

      <Panel title="Checklists aguardando aprovação" className="p-0 pt-6">
        <div className="overflow-x-auto px-6 pb-6">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2 font-medium">Proprietário</th>
                <th className="py-2 font-medium">Imóvel</th>
                <th className="py-2 font-medium">Pontuação</th>
                <th className="py-2 font-medium">Elegível</th>
                <th className="py-2 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage-200">
              {PENDING.map((p) => (
                <tr key={p.property}>
                  <td className="py-3 font-medium text-ink">{p.owner}</td>
                  <td className="py-3 text-muted">{p.property}</td>
                  <td className="py-3">
                    <span className="font-semibold text-forest">{p.score}</span>
                    <span className="text-muted">/100</span>
                    {p.score >= 70 && <span className="ml-2">🏆</span>}
                  </td>
                  <td className="py-3">
                    {p.eligible ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <ShieldCheck className="h-4 w-4" /> Sim
                      </span>
                    ) : (
                      <span className="text-red-600">Não</span>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end gap-2">
                      <button className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-700">
                        <Check className="h-3.5 w-3.5" /> Aprovar
                      </button>
                      <button className="inline-flex items-center gap-1 rounded-full border border-sage-200 px-3 py-1.5 text-xs font-medium text-ink hover:border-red-300 hover:text-red-600">
                        <X className="h-3.5 w-3.5" /> Recusar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
