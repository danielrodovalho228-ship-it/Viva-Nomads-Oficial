/**
 * Sugestões de localização para autocomplete (rodada 14).
 *
 * Bairros de Uberlândia + cidades atendidas, usados em <datalist> nativo nos
 * campos de localização (busca da home, filtros). Sem chave/serviço externo —
 * o ViaCEP cobre o autocomplete por CEP no cadastro; aqui é sugestão por nome.
 * Quando o Google Places estiver configurado, dá para evoluir para sugestões
 * dinâmicas mantendo os mesmos campos.
 */
export const UBERLANDIA_NEIGHBORHOODS = [
  "Centro",
  "Fundinho",
  "Santa Mônica",
  "Tibery",
  "Granja Marileusa",
  "Bairro Brasil",
  "Tabajaras",
  "Osvaldo Rezende",
  "Saraiva",
  "Lídice",
  "Jardim Patrícia",
  "Morada da Colina",
  "Cidade Jardim",
  "Umuarama",
  "Aparecida",
  "Roosevelt",
  "Daniel Fonseca",
  "Martins",
];

/** Cidades atendidas (com inventário). */
export const SERVED_CITIES = ["Uberlândia"];

/** Lista combinada para sugestão de "cidade ou bairro". */
export const LOCATION_SUGGESTIONS = [...SERVED_CITIES, ...UBERLANDIA_NEIGHBORHOODS];

/** <datalist> reutilizável para campos de localização. */
export function LocationDatalist({ id }: { id: string }) {
  return (
    <datalist id={id}>
      {LOCATION_SUGGESTIONS.map((s) => (
        <option key={s} value={s} />
      ))}
    </datalist>
  );
}
