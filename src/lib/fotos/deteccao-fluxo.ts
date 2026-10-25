/*
  DETECTA-B — a rodada de análise das fotos novas da galeria (PURO: tudo o que toca banco, bucket e modelo entra por
  dependência, para o teste provar as regras sem rede).
  • Desligada: devolve na hora, sem chamar nada.
  • Cache: foto já analisada (mesmo caminho ou mesmo hash dos bytes) não vai de novo ao modelo.
  • Limite por anúncio e por dono, contado ANTES de cada chamada.
  • Resposta inválida do modelo: grava a análise sem itens (não cobra de novo) e a tela segue; falha da API: não grava
    (tenta de novo na próxima vez, dentro do limite).
*/
import { FOTOS_POR_RODADA, linhasDaAnalise, validarDeteccao, type LinhaSugestao } from "./deteccao.ts";

export interface AnaliseParaGravar {
  caminho: string;
  hash: string;
  pessoa: boolean;
  valida: boolean;
  linhas: LinhaSugestao[];
}

export interface DepsDeteccao {
  ligada: boolean;
  /** Caminhos das fotos da galeria do anúncio (só a pasta do dono), na ordem da galeria. */
  fotos: () => Promise<string[]>;
  /** O que já foi analisado neste anúncio. */
  analisadas: () => Promise<{ caminhos: Set<string>; hashes: Set<string> }>;
  baixar: (caminho: string) => Promise<Uint8Array | null>;
  hash: (bytes: Uint8Array) => Promise<string>;
  /** Consome uma foto da cota do anúncio e do dono; false = acabou a cota de hoje. */
  limite: () => Promise<boolean>;
  /** Chama o modelo com a foto e devolve o JSON cru (lança se a API falhar). `indice` = posição na galeria. */
  modelo: (bytes: Uint8Array, indice: number) => Promise<unknown>;
  gravar: (a: AnaliseParaGravar) => Promise<void>;
  /** E142: a foto parece tela (print, cartão, documento)? Sim = não vai ao modelo e nunca vira sugestão. */
  pareceTela?: (bytes: Uint8Array) => Promise<boolean>;
  porRodada?: number;
}

export interface ResumoRodada {
  ligada: boolean;
  analisadas: number;
  invalidas: number;
  falhas: number;
  comPessoa: number;
  /** Fotos novas que ficaram para a próxima rodada. */
  restantes: number;
  limite: boolean;
  /** E142: fotos que pareciam tela (print, cartão) e ficaram fora da detecção. */
  telas?: number;
}

const VAZIO: ResumoRodada = { ligada: false, analisadas: 0, invalidas: 0, falhas: 0, comPessoa: 0, restantes: 0, limite: false };

export async function analisarFotosNovas(d: DepsDeteccao): Promise<ResumoRodada> {
  if (!d.ligada) return VAZIO;
  const r: ResumoRodada = { ...VAZIO, ligada: true };
  const fotos = await d.fotos();
  const ja = await d.analisadas();
  const novas = fotos.map((caminho, indice) => ({ caminho, indice })).filter((f) => !ja.caminhos.has(f.caminho));
  const max = d.porRodada ?? FOTOS_POR_RODADA;
  let feitas = 0;
  for (const f of novas) {
    if (feitas >= max) {
      r.restantes++;
      continue;
    }
    if (r.limite) {
      r.restantes++;
      continue;
    }
    feitas++;
    const bytes = await d.baixar(f.caminho);
    if (!bytes) {
      r.falhas++;
      continue;
    }
    const hash = await d.hash(bytes);
    if (ja.hashes.has(hash)) {
      // Mesma foto com outro caminho (enviada de novo): registra o caminho, sem modelo e sem cota.
      await d.gravar({ caminho: f.caminho, hash, pessoa: false, valida: true, linhas: [] });
      ja.caminhos.add(f.caminho);
      continue;
    }
    if (d.pareceTela && (await d.pareceTela(bytes))) {
      // E142: print ou cartão ("[TESTE QA]" lido como ar-condicionado) não é foto do imóvel: grava sem itens, sem cota.
      await d.gravar({ caminho: f.caminho, hash, pessoa: false, valida: false, linhas: [] });
      ja.caminhos.add(f.caminho);
      ja.hashes.add(hash);
      r.telas = (r.telas ?? 0) + 1;
      continue;
    }
    if (!(await d.limite())) {
      r.limite = true;
      r.restantes++;
      continue;
    }
    let bruto: unknown;
    try {
      bruto = await d.modelo(bytes, f.indice);
    } catch {
      r.falhas++;
      continue;
    }
    const v = validarDeteccao(bruto);
    if (!v.ok) r.invalidas++;
    else if (v.pessoa) r.comPessoa++;
    await d.gravar({ caminho: f.caminho, hash, pessoa: v.ok && v.pessoa, valida: v.ok, linhas: v.ok ? linhasDaAnalise(v) : [] });
    ja.caminhos.add(f.caminho);
    ja.hashes.add(hash);
    r.analisadas++;
  }
  return r;
}
