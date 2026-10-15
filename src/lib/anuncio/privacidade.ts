/*
  PRIVACIDADE E ACESSO DO IMÓVEL (ordem f92bc582) — regra pura, sem Supabase.
  Declaração do anunciante: sem câmeras dentro; câmeras externas (onde); tipo
  de acesso. Texto público sempre diz "declarado pelo anunciante".
*/

export const TEXTO_DECLARACAO_CAMERAS =
  "Não há câmeras, babás eletrônicas, microfones ou qualquer dispositivo que grave imagem ou som dentro do imóvel.";
export const MAX_CAMERAS_EXTERNAS = 200;

export const TIPOS_ACESSO = [
  { valor: "chave", rotulo: "Chave" },
  { valor: "fechadura_senha", rotulo: "Fechadura com senha" },
  { valor: "cofre", rotulo: "Cofre de chave" },
] as const;
export type TipoAcesso = (typeof TIPOS_ACESSO)[number]["valor"];

export function tipoAcessoValido(v: unknown): v is TipoAcesso {
  return TIPOS_ACESSO.some((t) => t.valor === v);
}

export interface Privacidade {
  semCamerasInterior: boolean;
  /** Texto curto de onde ficam as câmeras externas/áreas comuns; vazio = nenhuma. */
  camerasExternas: string;
  tipoAcesso: TipoAcesso | null;
  /** Só vale com fechadura com senha. */
  senhaTrocadaEstadia: boolean;
}

export const PRIVACIDADE_VAZIA: Privacidade = {
  semCamerasInterior: false,
  camerasExternas: "",
  tipoAcesso: null,
  senhaTrocadaEstadia: false,
};

/** Limpa o texto livre: sem caracteres de controle, espaços colapsados, até 200. */
export function limparCamerasExternas(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_CAMERAS_EXTERNAS);
}

/** Entrada do cliente → colunas do banco (o servidor nunca confia no formato). */
export function colunasPrivacidade(i: Partial<Privacidade>): Record<string, unknown> {
  const tipo = tipoAcessoValido(i.tipoAcesso) ? i.tipoAcesso : null;
  const externas = limparCamerasExternas(i.camerasExternas);
  return {
    sem_cameras_interior: i.semCamerasInterior === true,
    cameras_externas: externas || null,
    tipo_acesso: tipo,
    senha_trocada_estadia: tipo === "fechadura_senha" && i.senhaTrocadaEstadia === true,
  };
}

/** A prova de que a declaração foi feita (a prontidão usa isto). */
export function declaracaoCamerasFeita(v: boolean | null | undefined): boolean {
  return v === true;
}

/** Linhas do bloco "Privacidade" do anúncio público (vazio = nada declarado). */
export function linhasPrivacidadePublica(p: Partial<Privacidade> | null | undefined): string[] {
  if (!p) return [];
  const l: string[] = [];
  if (p.semCamerasInterior) l.push("Sem câmeras no interior (declarado pelo anunciante)");
  const ext = limparCamerasExternas(p.camerasExternas);
  if (p.semCamerasInterior) l.push(ext ? `Câmeras externas: ${ext}` : "Sem câmeras externas declaradas");
  if (tipoAcessoValido(p.tipoAcesso)) {
    const rot = TIPOS_ACESSO.find((t) => t.valor === p.tipoAcesso)!.rotulo;
    l.push(`Acesso: ${rot}`);
    if (p.tipoAcesso === "fechadura_senha" && p.senhaTrocadaEstadia) l.push("A senha é trocada antes de cada nova estadia");
  }
  return l;
}

/** Lembrete na entrada do contrato, quando o acesso é por fechadura com senha. */
export const LEMBRETE_SENHA_ENTRADA =
  "Confirme que recebeu uma senha nova. Se não, peça a troca pelo chat.";

/** Só o inquilino, com fechadura com senha, no contrato em andamento e já assinado pelas duas partes. */
export function mostrarLembreteSenha(i: {
  papel: string;
  tipoAcesso: string | null | undefined;
  status: string;
  assinadoPelasDuasPartes: boolean;
}): boolean {
  return i.papel === "inquilino" && i.tipoAcesso === "fechadura_senha" && i.status === "ativo" && i.assinadoPelasDuasPartes;
}

/** Item do checklist da conferência de entrada (ordem f92bc582, item 5): só o inquilino vê. */
export const ITEM_CONFERENCIA_CAMERAS = "Conferi que não há câmeras ou dispositivos de gravação dentro do imóvel.";
export const DICAS_CONFERENCIA_CAMERAS = [
  "Olhe detectores de fumaça, carregadores, relógios, tomadas e a TV.",
  "Apague a luz e passe a lanterna do celular: uma lente costuma refletir um ponto de luz.",
  "Se achar algo, não mexa no aparelho: fotografe e abra um chamado em Ajuda (\"Encontrei câmera ou dispositivo\").",
] as const;

/** O checklist aparece só ao inquilino, no contrato em andamento. */
export function mostrarChecklistCameras(i: { papel: string; status: string }): boolean {
  return i.papel === "inquilino" && i.status === "ativo";
}

export interface PrivacidadeLinha {
  sem_cameras_interior?: boolean | null;
  cameras_externas?: string | null;
  tipo_acesso?: string | null;
  senha_trocada_estadia?: boolean | null;
}

/** Linha do banco → Privacidade. Sem linha (coluna ausente/erro) = indefinido. */
export function privacidadeDaLinha(l: PrivacidadeLinha | null | undefined): Privacidade | undefined {
  if (!l || typeof l.sem_cameras_interior !== "boolean") return undefined;
  return {
    semCamerasInterior: l.sem_cameras_interior,
    camerasExternas: limparCamerasExternas(l.cameras_externas),
    tipoAcesso: tipoAcessoValido(l.tipo_acesso) ? l.tipo_acesso : null,
    senhaTrocadaEstadia: l.senha_trocada_estadia === true,
  };
}
