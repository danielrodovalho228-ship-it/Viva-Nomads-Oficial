import {
  CalendarRange,
  PawPrint,
  Cigarette,
  Users,
  LogIn,
  LogOut,
  Sofa,
  ShieldCheck,
} from "lucide-react";
import type { Property } from "@/lib/types";

/**
 * Regras da estadia: duração, mobília, animais, fumante, hóspedes, check-in/out
 * e garantias aceitas. Cada linha só aparece quando o dado existe — a duração
 * (30–180 dias) é sempre exibida por ser do modelo.
 */
export function StayRules({ property }: { property: Property }) {
  const rows: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }[] = [
    {
      icon: CalendarRange,
      label: "Duração",
      value: `De ${property.minPeriodDays} a 180 dias`,
    },
  ];

  if (property.furnished !== undefined)
    rows.push({ icon: Sofa, label: "Mobília", value: property.furnished ? "Mobiliado e equipado" : "Sem mobília" });
  if (property.petsAllowed !== undefined)
    rows.push({ icon: PawPrint, label: "Animais", value: property.petsAllowed ? "Aceita animais" : "Não aceita animais" });
  if (property.smokingAllowed !== undefined)
    rows.push({ icon: Cigarette, label: "Fumante", value: property.smokingAllowed ? "Permitido fumar" : "Não é permitido fumar" });
  if (property.maxGuests !== undefined)
    rows.push({ icon: Users, label: "Hóspedes", value: `Até ${property.maxGuests} ${property.maxGuests === 1 ? "pessoa" : "pessoas"}` });
  if (property.checkinAfter)
    rows.push({ icon: LogIn, label: "Check-in", value: `A partir das ${property.checkinAfter}` });
  if (property.checkoutBefore)
    rows.push({ icon: LogOut, label: "Check-out", value: `Até às ${property.checkoutBefore}` });

  return (
    <section aria-labelledby="regras-title">
      <h2 id="regras-title" className="font-title text-2xl font-bold text-ink">
        Regras da estadia
      </h2>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-3 rounded-xl border border-sage-200 px-4 py-3">
            <r.icon className="mt-0.5 h-5 w-5 shrink-0 text-sage" />
            <span>
              <span className="block text-xs text-muted">{r.label}</span>
              <span className="block text-sm font-medium text-ink">{r.value}</span>
            </span>
          </li>
        ))}
      </ul>

      {/* Garantias e pagamento (diferencial brasileiro) */}
      <div className="mt-4 rounded-xl bg-sage-100/60 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-forest">
          <ShieldCheck className="h-4 w-4 text-sage" /> Garantias e pagamento
        </h3>
        <ul className="mt-2 space-y-1 text-sm text-ink">
          <li>• Caução conforme contrato — registrada e documentada pela plataforma.</li>
          {property.acceptsInsurance && <li>• Aceita seguro-fiança.</li>}
          <li className="text-muted">
            O pagamento do aluguel é feito direto ao proprietário — a plataforma conecta,
            verifica, documenta e registra, mas nunca retém o dinheiro.
          </li>
        </ul>
      </div>
    </section>
  );
}
