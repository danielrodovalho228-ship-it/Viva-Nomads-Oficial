/**
 * Categorias profissionais do inquilino — FONTE ÚNICA.
 *
 * Consumida pelo select da Conta (Perfil profissional), pela candidatura, pelo
 * laudo ao proprietário e (futuro) pelo matching. Nada de rótulos soltos
 * espalhados: mudou aqui, muda em todo lugar.
 *
 * Valor ARMAZENADO em `profiles.professional_category`:
 *   • uma `key` dos grupos abaixo (ex.: "saude_medico_residente");
 *   • "nao_informar" (Prefiro não informar);
 *   • "outro:<texto livre>" (máx. 40 chars, MESMA sanitização do bloqueio de
 *     contato — sem telefone/e-mail/apps).
 * Para exibir a terceiros, use SEMPRE `categoriaLabel(value)` — sem ranking nem
 * juízo, só o rótulo escolhido.
 *
 * Módulo SEM imports de propósito: puro e testável via `node --test`. A
 * sanitização do campo livre "Outro" (que precisa de `contemContato`) vive na
 * server action `setMinhaCategoria`.
 */

export interface CategoriaOpcao {
  key: string;
  label: string;
}

export interface CategoriaGrupo {
  grupo: string;
  opcoes: CategoriaOpcao[];
}

export const CATEGORIA_OUTRO_PREFIX = "outro:";
export const CATEGORIA_NAO_INFORMAR = "nao_informar";
export const CATEGORIA_OUTRO_MAXLEN = 40;

export const CATEGORIAS_PROFISSIONAIS: CategoriaGrupo[] = [
  {
    grupo: "Saúde",
    opcoes: [
      { key: "saude_medico_residente", label: "Médico(a) residente" },
      { key: "saude_medico_temporario", label: "Médico(a)/especialista temporário" },
      { key: "saude_enfermagem", label: "Enfermagem e técnicos" },
      { key: "saude_outros", label: "Outros profissionais de saúde" },
    ],
  },
  {
    grupo: "Trabalho e negócios",
    opcoes: [
      { key: "trabalho_realocacao", label: "Realocação/transferência" },
      { key: "trabalho_consultor", label: "Consultor(a)/projeto" },
      { key: "trabalho_engenharia", label: "Engenharia e obras" },
      { key: "trabalho_agronegocio", label: "Agronegócio/safra" },
      { key: "trabalho_comercial", label: "Representante comercial" },
      { key: "trabalho_militar", label: "Militar/segurança (transferência)" },
      { key: "trabalho_remoto", label: "Trabalho remoto/nômade digital" },
      { key: "trabalho_empreendedor", label: "Empreendedor(a) abrindo operação" },
    ],
  },
  {
    grupo: "Educação",
    opcoes: [
      { key: "educacao_graduacao", label: "Estudante de graduação" },
      { key: "educacao_pos", label: "Pós/mestrado/doutorado" },
      { key: "educacao_professor", label: "Professor(a)/pesquisador(a) visitante" },
      { key: "educacao_tecnico", label: "Curso técnico/concurso/intercâmbio" },
    ],
  },
  {
    grupo: "Vida e transições",
    opcoes: [
      { key: "vida_tratamento", label: "Tratamento de saúde (paciente/acompanhante)" },
      { key: "vida_mudanca", label: "Mudança de cidade/nova fase" },
      { key: "vida_reforma", label: "Reforma/venda do imóvel próprio" },
      { key: "vida_atleta", label: "Atleta/esporte" },
      { key: "vida_aposentado", label: "Aposentado(a)/estadia prolongada" },
    ],
  },
];

/** Mapa key → label (todas as opções dos grupos). */
const LABEL_POR_KEY: Record<string, string> = Object.fromEntries(
  CATEGORIAS_PROFISSIONAIS.flatMap((g) => g.opcoes.map((o) => [o.key, o.label]))
);

/** Todas as keys válidas dos grupos. */
export function isCategoriaKey(value: string): boolean {
  return value in LABEL_POR_KEY;
}

/**
 * DE-PARA das 5 categorias ANTIGAS (texto livre salvo antes) → novas keys.
 * Usado na migração 0039 e como rede de segurança no `categoriaLabel`.
 */
export const DE_PARA_CATEGORIAS: Record<string, string> = {
  "Médico / saúde": "saude_outros",
  "Executivo / corporativo": "trabalho_realocacao",
  "Nômade digital / remoto": "trabalho_remoto",
  "Estudante / intercâmbio": "educacao_graduacao",
  Outro: CATEGORIA_OUTRO_PREFIX, // vira "outro:" (sem texto livre)
};

/**
 * Rótulo de exibição para terceiros (laudo/candidatura). Nunca ranqueia nem
 * julga — só devolve o texto escolhido. "" quando não informado/ausente.
 */
export function categoriaLabel(value?: string | null): string {
  if (!value) return "";
  if (value === CATEGORIA_NAO_INFORMAR) return "Prefiro não informar";
  if (value.startsWith(CATEGORIA_OUTRO_PREFIX)) {
    const livre = value.slice(CATEGORIA_OUTRO_PREFIX.length).trim();
    return livre || "Outro";
  }
  if (LABEL_POR_KEY[value]) return LABEL_POR_KEY[value];
  // Legado (5 antigas salvas como texto): mapeia se conhecido, senão devolve cru.
  const mapped = DE_PARA_CATEGORIAS[value];
  if (mapped && LABEL_POR_KEY[mapped]) return LABEL_POR_KEY[mapped];
  return value;
}
