import type { Property } from "./types";

/*
  Dados de exemplo para popular as telas públicas enquanto o Supabase
  não está conectado. As fotos são placeholders (sem imagens reais).
  Substituídos por dados reais do banco nas fases de integração.
*/
export const SAMPLE_PROPERTIES: Property[] = [
  {
    id: "ube-001",
    title: "Apartamento mobiliado com home office no Santa Mônica",
    description:
      "Apartamento completo, pronto para morar, com cômodo dedicado ao trabalho, internet fibra e ótima localização para quem está chegando a Uberlândia.",
    propertyType: "Apartamento",
    city: "Uberlândia",
    state: "MG",
    neighborhood: "Santa Mônica",
    lat: -18.918,
    lng: -48.257,
    bedrooms: 2,
    bathrooms: 2,
    areaM2: 68,
    minPeriodDays: 30,
    monthlyPrice: 3200,
    status: "active",
    workReadyBadge: true,
    workScore: 86,
    photos: ["[FOTO — fachada]", "[FOTO — sala]", "[FOTO — home office]", "[FOTO — quarto]"],
    amenities: ["Mobiliado completo", "Ar-condicionado", "Máquina de lavar", "Cozinha equipada"],
    workFeatures: ["Escritório dedicado", "Mesa de trabalho", "Cadeira ergonômica", "Internet fibra 300 Mbps"],
    nearbyWorkspaces: [
      { name: "Coworking Center Santa Mônica", type: "coworking", distanceM: 850 },
      { name: "Café do Bloco", type: "cafe", distanceM: 400 },
    ],
    ownerName: "Marcos A.",
  },
  {
    id: "ube-002",
    title: "Studio premium no Centro, ideal para estadia profissional",
    description:
      "Studio mobiliado no coração da cidade, próximo a hospitais e coworkings. Perfeito para profissionais de saúde em plantão ou residência.",
    propertyType: "Studio",
    city: "Uberlândia",
    state: "MG",
    neighborhood: "Centro",
    lat: -18.913,
    lng: -48.275,
    bedrooms: 1,
    bathrooms: 1,
    areaM2: 38,
    minPeriodDays: 30,
    monthlyPrice: 2400,
    status: "active",
    workReadyBadge: true,
    workScore: 74,
    photos: ["[FOTO — fachada]", "[FOTO — ambiente]", "[FOTO — cozinha]"],
    amenities: ["Mobiliado completo", "Ar-condicionado", "Cozinha equipada", "Aceita pets"],
    workFeatures: ["Mesa de trabalho", "Internet fibra 200 Mbps"],
    nearbyWorkspaces: [
      { name: "Hub Central Coworking", type: "coworking", distanceM: 600 },
      { name: "Sala Reunião Empresarial", type: "meeting_room", distanceM: 900 },
    ],
    ownerName: "Patrícia L.",
  },
  {
    id: "ube-003",
    title: "Casa 3 quartos para famílias em transição",
    description:
      "Casa espaçosa e mobiliada, garagem e quintal. Ideal para famílias em mudança, reforma ou espera pelo imóvel próprio.",
    propertyType: "Casa",
    city: "Uberlândia",
    state: "MG",
    neighborhood: "Tibery",
    lat: -18.89,
    lng: -48.24,
    bedrooms: 3,
    bathrooms: 2,
    areaM2: 120,
    minPeriodDays: 60,
    monthlyPrice: 4100,
    status: "active",
    workReadyBadge: false,
    workScore: 52,
    photos: ["[FOTO — fachada]", "[FOTO — sala]", "[FOTO — quintal]"],
    amenities: ["Mobiliado completo", "Máquina de lavar", "Cozinha equipada", "Aceita pets"],
    workFeatures: ["Internet fibra 100 Mbps"],
    nearbyWorkspaces: [{ name: "Coworking Tibery", type: "coworking", distanceM: 1800 }],
    ownerName: "Família Souza (gestão)",
  },
];

export function getPropertyById(id: string): Property | undefined {
  return SAMPLE_PROPERTIES.find((p) => p.id === id);
}

export function getPropertiesByCity(city: string): Property[] {
  const target = city.toLowerCase();
  return SAMPLE_PROPERTIES.filter((p) => p.city.toLowerCase() === target);
}
