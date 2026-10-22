import {
  AirVent, Armchair, Bike, Building, Car, CookingPot, Dumbbell, Fan, Flame, Laptop, MonitorSmartphone,
  Refrigerator, Shirt, ShieldCheck, Sofa, Soup, Tv, UtensilsCrossed, VolumeX, Waves, WashingMachine,
  Wifi, Camera, Microwave, Users, DoorOpen, Sun, Check, Lamp, Plug, type LucideIcon,
} from "lucide-react";
import { AMENITY_KEY_BY_LABEL } from "../amenities.ts";

/** Chave canônica → ícone. Fonte ÚNICA: página do imóvel, lista completa e card do mapa. */
export const ICONE_POR_CHAVE: Record<string, LucideIcon> = {
  home_office: Laptop,
  internet_fibra: Wifi,
  mesa_trabalho: Laptop,
  cadeira_ergonomica: Armchair,
  ambiente_silencioso: VolumeX,
  iluminacao_boa: Lamp,
  tomadas_mesa: Plug,
  sala_reuniao: Users,
  coworking: Building,
  cabine_chamadas: MonitorSmartphone,
  mobiliado: Sofa,
  ar_condicionado: AirVent,
  maquina_lavar: WashingMachine,
  lava_loucas: UtensilsCrossed,
  enxoval: Shirt,
  cozinha_equipada: CookingPot,
  varanda: Sun,
  academia: Dumbbell,
  piscina: Waves,
  portaria_24h: ShieldCheck,
  elevador: DoorOpen,
  salao_festas: Users,
  churrasqueira: Flame,
  lavanderia: WashingMachine,
  bicicletario: Bike,
  vaga_garagem: Car,
};

/** Ícone de texto livre (comodidades antigas, sem chave): palavra-chave → ícone. */
const POR_PALAVRA: [RegExp, LucideIcon][] = [
  [/wi-?fi|internet|fibra/, Wifi],
  [/ar[- ]?condicionado|climatiza/, AirVent],
  [/ventilador/, Fan],
  [/aquecimento|aquecedor|lareira/, Flame],
  [/lava[- ]?lou[cç]as/, UtensilsCrossed],
  [/m[aá]quina de lavar|lavanderia|lavadora/, WashingMachine],
  [/geladeira|refrigerador|freezer/, Refrigerator],
  [/micro-?ondas/, Microwave],
  [/fog[aã]o|cooktop|forno|cozinha/, CookingPot],
  [/cafeteira|liquidificador|utens[ií]lios/, Soup],
  [/\btv\b|televis/, Tv],
  [/mesa|escrivaninha|home ?office|escrit[oó]rio|trabalho/, Laptop],
  [/cadeira/, Armchair],
  [/arm[aá]rio|guarda-?roupa|sof[aá]|mobili/, Sofa],
  [/roupa de cama|enxoval|toalha/, Shirt],
  [/garagem|estacionamento|vaga/, Car],
  [/portaria|seguran|alarme|fechadura|cofre/, ShieldCheck],
  [/c[aâ]mera/, Camera],
  [/piscina/, Waves],
  [/academia/, Dumbbell],
  [/bicicl|bike/, Bike],
  [/churrasq/, Flame],
  [/elevador/, DoorOpen],
  [/varanda|sacada/, Sun],
  [/silenci/, VolumeX],
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Ícone Lucide da comodidade (rótulo da Viva ou chave); ícone padrão (check) quando não há par. */
export function iconeDaComodidade(rotuloOuChave: string): LucideIcon {
  const chave = ICONE_POR_CHAVE[rotuloOuChave] ? rotuloOuChave : AMENITY_KEY_BY_LABEL[rotuloOuChave];
  if (chave && ICONE_POR_CHAVE[chave]) return ICONE_POR_CHAVE[chave];
  const t = semAcento(rotuloOuChave);
  for (const [re, Icone] of POR_PALAVRA) if (re.test(t) || re.test(rotuloOuChave.toLowerCase())) return Icone;
  return Check;
}

/** Padrão visual único (Prompt 47): 24 px e o mesmo traço em todos os ícones de lista e de fatos. */
export const CLASSE_ICONE_LISTA = "h-6 w-6 shrink-0 text-sage";
export const TRACO_ICONE_LISTA = 1.75;
