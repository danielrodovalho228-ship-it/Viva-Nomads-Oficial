import { MapPin } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { estadoMapas } from "@/lib/integracoes/mapas";
import { cn } from "@/lib/utils";

function Linha({ nome, ligado, testId }: { nome: string; ligado: boolean; testId: string }) {
  return (
    <li className="flex items-center justify-between gap-3" data-testid={testId} data-estado={ligado ? "ligado" : "desligado"}>
      <span>{nome}</span>
      <span className={cn("rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold", ligado ? "text-forest" : "text-red-800")}>
        {ligado ? "ligado" : "desligado"}
      </span>
    </li>
  );
}

/** Estado do mapa e de "o que tem perto" no /admin (só lê se a chave existe; nunca mostra a chave). */
export function CartaoMapas() {
  const { mapa, lugaresProximos } = estadoMapas();
  return (
    <Panel title="Mapas">
      <p className="mb-3 flex items-center gap-2 text-sm text-ink/70">
        <MapPin className="h-4 w-4" aria-hidden /> Desligado = a página mostra o aviso no lugar do mapa.
      </p>
      <ul className="space-y-2 text-sm text-ink" data-testid="admin-mapas">
        <Linha nome="Mapa" ligado={mapa} testId="admin-mapas-mapa" />
        <Linha nome="Lugares próximos" ligado={lugaresProximos} testId="admin-mapas-lugares" />
      </ul>
    </Panel>
  );
}
