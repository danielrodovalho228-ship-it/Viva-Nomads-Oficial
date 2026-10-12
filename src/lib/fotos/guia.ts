/** Conteúdo do guia "Como tirar boas fotos" (ordem bcf0da28). Dados puros, testáveis. */
import { AVISO_TESTES } from "../aviso-testes.ts";

export const DICAS_FOTO = [
  "Arrume o ambiente e tire objetos pessoais, roupas, louça e lixo.",
  "Luz natural: abra as cortinas, acenda as luzes e fotografe de dia.",
  "Câmera na altura do peito, do canto do cômodo, com o celular nivelado (linhas retas).",
  "Celular na horizontal para cômodos e na vertical para detalhes e banheiro estreito.",
  "Use a lente grande-angular (0,5x), se tiver, sem distorcer demais.",
  "Uma foto por ambiente, mais fachada e vista (e home office, cozinha e banheiro).",
  "Sem filtros, prints ou fotos da internet: a análise automática barra.",
] as const;

export interface ParExemplo {
  ambiente: "Sala" | "Quarto";
  ruim: string;
  bom: string;
}

/** Imagens 1200x896 (4:3) que o Daniel sobe em public/guia-fotos/. Enquanto não existem, o componente mostra placeholder. */
export const PARES_EXEMPLO: readonly ParExemplo[] = [
  { ambiente: "Sala", ruim: "/guia-fotos/sala_ruim.webp", bom: "/guia-fotos/sala_boa.webp" },
  { ambiente: "Quarto", ruim: "/guia-fotos/quarto_ruim.webp", bom: "/guia-fotos/quarto_bom.webp" },
];

export const RODAPE_GUIA = AVISO_TESTES;
export const ROTA_GUIA = "/guia-fotos";
export const ROTA_FOTOGRAFOS = "/parceiros/fotografos";
