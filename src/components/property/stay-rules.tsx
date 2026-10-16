import {
  CalendarRange,
  PawPrint,
  Cigarette,
  Users,
  LogIn,
  LogOut,
  Sofa,
  ShieldCheck,
  Landmark,
  FileCheck,
  HandCoins,
} from "lucide-react";
import type { Property } from "@/lib/types";
import { linhasRegrasPets } from "@/lib/anuncio/pets-regras";

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
    rows.push({
      icon: PawPrint,
      label: "Animais",
      value:
        property.petsAllowed && property.petsRegras
          ? linhasRegrasPets(property.petsRegras).join(" · ")
          : property.petsAllowed
            ? "Aceita animais"
            : "Não aceita animais",
    });
  if (property.smokingAllowed !== undefined)
    rows.push({ icon: Cigarette, label: "Fumante", value: property.smokingAllowed ? "Permitido fumar" : "Não é permitido fumar" });
  if (property.maxGuests !== undefined)
    rows.push({ icon: Users, label: "Moradores", value: `Até ${property.maxGuests} ${property.maxGuests === 1 ? "pessoa" : "pessoas"}` });
  if (property.checkinAfter)
    rows.push({ icon: LogIn, label: "Entrada", value: `A partir das ${property.checkinAfter}` });
  if (property.checkoutBefore)
    rows.push({ icon: LogOut, label: "Saída", value: `Até as ${property.checkoutBefore}` });

  return (
    <section id="regras-da-estadia" aria-labelledby="regras-title">
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

      {/* Caução e pagamento (diferencial brasileiro) */}
      <div className="mt-4 rounded-xl bg-sage-100/60 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-forest">
          <ShieldCheck className="h-4 w-4 text-sage" /> Caução e pagamento
        </h3>
        <ul className="mt-3 space-y-2.5 text-sm text-ink" data-testid="caucao-lista">
          <li className="flex items-start gap-3">
            <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-sage" strokeWidth={1.75} aria-hidden />
            Caução conforme contrato — registrada e documentada pela plataforma.
          </li>
          {property.acceptsInsurance && (
            <li className="flex items-start gap-3">
              <FileCheck className="mt-0.5 h-5 w-5 shrink-0 text-sage" strokeWidth={1.75} aria-hidden />
              Aceita Seguro-Fiança.
            </li>
          )}
          <li className="flex items-start gap-3 text-muted">
            <HandCoins className="mt-0.5 h-5 w-5 shrink-0 text-sage" strokeWidth={1.75} aria-hidden />
            <span>O pagamento do valor mensal é feito direto ao proprietário — a plataforma conecta,
            confere a documentação do imóvel e registra a negociação, mas nunca recebe o dinheiro.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
