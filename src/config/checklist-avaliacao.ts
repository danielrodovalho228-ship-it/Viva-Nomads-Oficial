/*
  Prompt 62-B2 — CHECKLIST ÚNICO da avaliação do imóvel (versionado). Constante ÚNICA: o formulário do avaliador, o
  cálculo do resultado, o nível sustentado e o laudo VIS leem daqui. Cada item: conforme | não conforme | não se aplica,
  com critério objetivo escrito. "Teste em uso" é feito com o item funcionando (chuveiro, ar, faca, panela).
  Ligações:
  - `conforto`: chave do padrão mínimo (conforto-minimo.ts v2) que o item confere — o Essencial do nível;
  - `nivel`: chave de Conforto/Premium (niveis.ts) que o item confere;
  - `grave`: segurança grave (gás, fiação exposta, fechadura da entrada) — não conforme tira o anúncio da busca na hora;
  - `reverificacao`: como a ressalva se corrige ("foto" ou nova "visita"), definido aqui por item.
  FOTOS (minimização): 1 por cômodo + 1 por item não conforme; sem pessoas; sem pertences do morador; EXIF removido.
*/

export const VERSAO_CHECKLIST = 1;

export const GRUPOS_AVALIACAO = [
  { id: "fotos", rotulo: "Fotos × anúncio" },
  { id: "conforto", rotulo: "Conforto" },
  { id: "clima", rotulo: "Clima" },
  { id: "cozinha", rotulo: "Cozinha" },
  { id: "trabalho", rotulo: "Trabalho" },
  { id: "limpeza", rotulo: "Limpeza" },
  { id: "seguranca", rotulo: "Segurança" },
  { id: "internet", rotulo: "Internet" },
  { id: "ruido", rotulo: "O que considerar e ruído" },
] as const;
export type GrupoAvaliacao = (typeof GRUPOS_AVALIACAO)[number]["id"];

/** Valor de um item. Limpeza tem 3 níveis próprios; os demais, conforme / não conforme / não se aplica. */
export type ValorItem = "conforme" | "nao_conforme" | "nao_se_aplica" | "pronto" | "leve" | "nao_habitavel";

export interface ItemChecklist {
  chave: string;
  grupo: GrupoAvaliacao;
  rotulo: string;
  criterio: string;
  testeEmUso?: boolean;
  grave?: boolean;
  /** Item do padrão mínimo que este item confere (Essencial). */
  conforto?: string;
  /** Item de Conforto/Premium que este item confere. */
  nivel?: string;
  /** Só registra (não muda o resultado), ex.: detector e extintor. */
  registro?: boolean;
  /** Pode ser "não se aplica" (ex.: o item não foi declarado no anúncio). */
  aceitaNaoSeAplica?: boolean;
  tipo?: "limpeza" | "cheiro";
  reverificacao: "foto" | "visita";
}

export const ITENS_CHECKLIST = [
  // 1) Fotos × anúncio
  { chave: "fotos_comodos", grupo: "fotos", rotulo: "Cômodos conferem com as fotos", criterio: "Cada cômodo confere com as fotos publicadas do anúncio.", conforto: "mobilia_das_fotos", reverificacao: "foto" },
  { chave: "fotos_nada_omitido", grupo: "fotos", rotulo: "Nada essencial omitido", criterio: "As fotos não escondem defeito ou ausência de item essencial (cômodo, janela, banheiro, cozinha).", reverificacao: "visita" },
  { chave: "fotos_mobilia_prometida", grupo: "fotos", rotulo: "Mobília prometida presente", criterio: "Toda a mobília prometida no anúncio está no imóvel.", conforto: "mobilia_das_fotos", reverificacao: "foto" },
  // 2) Conforto — padrão mínimo v2 + itens de nível de sono, banho e lavanderia
  { chave: "cama_colchao", grupo: "conforto", rotulo: "Cama e colchão", criterio: "Cama com colchão para cada ocupante anunciado.", conforto: "cama_colchao", reverificacao: "foto" },
  { chave: "colchao_estado", grupo: "conforto", rotulo: "Colchão sem afundamento, mancha ou odor", criterio: "Colchão sem afundamento visível ao deitar, sem mancha e sem odor.", conforto: "cama_colchao", testeEmUso: true, reverificacao: "foto" },
  { chave: "roupa_cama_banho", grupo: "conforto", rotulo: "Roupa de cama e banho", criterio: "Um jogo de roupa de cama por cama e 2 toalhas de banho por pessoa.", conforto: "roupa_cama_banho", reverificacao: "foto" },
  { chave: "apoio_cama", grupo: "conforto", rotulo: "Apoio junto à cama", criterio: "Mesa de cabeceira ou apoio, luz de leitura e tomada ao alcance de cada cama.", conforto: "apoio_cama", reverificacao: "foto" },
  { chave: "chuveiro_teste", grupo: "conforto", rotulo: "Chuveiro: água quente e pressão", criterio: "Chuveiro ligado: a água esquenta e a pressão permite um banho normal.", conforto: "agua_quente", testeEmUso: true, reverificacao: "visita" },
  { chave: "iluminacao", grupo: "conforto", rotulo: "Iluminação", criterio: "Luz funcionando em todos os cômodos.", conforto: "iluminacao", reverificacao: "foto" },
  { chave: "lavanderia_acesso", grupo: "conforto", rotulo: "Acesso a máquina de lavar", criterio: "Máquina de lavar no imóvel, ou no prédio com uso incluído.", conforto: "lavanderia_acesso", reverificacao: "foto" },
  { chave: "sala_assentos", grupo: "conforto", rotulo: "Assento para todos na sala", criterio: "Assento na sala para todos os ocupantes.", nivel: "sala_assentos", aceitaNaoSeAplica: true, reverificacao: "foto" },
  { chave: "sono_dois_jogos", grupo: "conforto", rotulo: "2 jogos de roupa de cama", criterio: "Dois jogos de roupa de cama por cama.", nivel: "sono_dois_jogos", aceitaNaoSeAplica: true, reverificacao: "foto" },
  { chave: "sono_dois_travesseiros", grupo: "conforto", rotulo: "2 travesseiros por pessoa", criterio: "Dois travesseiros por pessoa.", nivel: "sono_dois_travesseiros", aceitaNaoSeAplica: true, reverificacao: "foto" },
  { chave: "sono_padrao_hotel", grupo: "conforto", rotulo: "Cama padrão hotel", criterio: "Colchão com protetor, 2 jogos de enxoval por cama e edredom ou cobertor por estação.", nivel: "sono_padrao_hotel", aceitaNaoSeAplica: true, reverificacao: "foto" },
  { chave: "sono_cortina_escura", grupo: "conforto", rotulo: "Cortina que escurece", criterio: "Cortina que escurece o quarto.", nivel: "sono_cortina_escura", aceitaNaoSeAplica: true, reverificacao: "foto" },
  { chave: "banho_dois_jogos_toalhas", grupo: "conforto", rotulo: "2 jogos de toalhas por pessoa", criterio: "Dois jogos de toalhas (banho e rosto) por pessoa.", nivel: "banho_dois_jogos_toalhas", aceitaNaoSeAplica: true, reverificacao: "foto" },
  { chave: "banho_rosto_tapete", grupo: "conforto", rotulo: "Toalha de rosto e tapete", criterio: "Toalha de rosto e tapete de banheiro.", nivel: "banho_rosto_tapete", aceitaNaoSeAplica: true, reverificacao: "foto" },
  { chave: "lavadora_no_imovel", grupo: "conforto", rotulo: "Máquina de lavar no imóvel", criterio: "Máquina de lavar dentro do imóvel.", nivel: "lavadora_no_imovel", aceitaNaoSeAplica: true, reverificacao: "foto" },
  { chave: "lavadora_secadora", grupo: "conforto", rotulo: "Lavadora e secadora", criterio: "Lavadora e secadora, ou lava e seca, no imóvel.", nivel: "lavadora_secadora", aceitaNaoSeAplica: true, reverificacao: "foto" },
  // 3) Clima
  { chave: "ventilacao_quartos", grupo: "clima", rotulo: "Ventilação em cada quarto", criterio: "Ventilação ou climatização em cada quarto.", conforto: "ventilacao_quartos", reverificacao: "foto" },
  { chave: "ar_quarto_principal", grupo: "clima", rotulo: "Ar no quarto principal resfriando", criterio: "Ar-condicionado ligado e resfriando no quarto principal.", nivel: "ar_quarto_principal", testeEmUso: true, aceitaNaoSeAplica: true, reverificacao: "visita" },
  { chave: "ar_todos_quartos", grupo: "clima", rotulo: "Ar em todos os quartos resfriando", criterio: "Cada aparelho declarado nos quartos ligado e resfriando.", nivel: "ar_todos_quartos", testeEmUso: true, aceitaNaoSeAplica: true, reverificacao: "visita" },
  { chave: "ar_sala", grupo: "clima", rotulo: "Ar na sala resfriando", criterio: "Ar-condicionado da sala ligado e resfriando.", nivel: "ar_sala", testeEmUso: true, aceitaNaoSeAplica: true, reverificacao: "visita" },
  // 4) Cozinha
  { chave: "cozinha_basica", grupo: "cozinha", rotulo: "Cozinha básica", criterio: "Geladeira, fogão ou cooktop e utensílios básicos funcionando.", conforto: "cozinha_basica", reverificacao: "foto" },
  { chave: "faca_corta", grupo: "cozinha", rotulo: "Faca que corta", criterio: "Uma faca de cozinha corta um alimento firme sem esforço.", conforto: "cozinha_basica", testeEmUso: true, reverificacao: "foto" },
  { chave: "panela_revestimento", grupo: "cozinha", rotulo: "Panela sem revestimento descascando", criterio: "Nenhuma panela com revestimento antiaderente descascando.", conforto: "cozinha_basica", testeEmUso: true, reverificacao: "foto" },
  { chave: "cozinha_microondas", grupo: "cozinha", rotulo: "Micro-ondas", criterio: "Micro-ondas funcionando.", nivel: "cozinha_microondas", testeEmUso: true, aceitaNaoSeAplica: true, reverificacao: "foto" },
  { chave: "mesa_jantar_todos", grupo: "cozinha", rotulo: "Mesa de jantar para todos", criterio: "Mesa e cadeiras de jantar para todos os ocupantes.", nivel: "mesa_jantar_todos", aceitaNaoSeAplica: true, reverificacao: "foto" },
  { chave: "cozinha_forno", grupo: "cozinha", rotulo: "Forno", criterio: "Forno funcionando.", nivel: "cozinha_forno", testeEmUso: true, aceitaNaoSeAplica: true, reverificacao: "foto" },
  { chave: "louca_completa", grupo: "cozinha", rotulo: "Louça completa", criterio: "Louça e utensílios para todos os ocupantes.", nivel: "louca_completa", aceitaNaoSeAplica: true, reverificacao: "foto" },
  // 5) Trabalho (quando declarados)
  { chave: "trabalho_mesa_cadeira", grupo: "trabalho", rotulo: "Mesa e cadeira de trabalho", criterio: "Mesa de trabalho e cadeira.", nivel: "trabalho_mesa_cadeira", aceitaNaoSeAplica: true, reverificacao: "foto" },
  { chave: "trabalho_cadeira_regulavel", grupo: "trabalho", rotulo: "Cadeira com regulagem de altura", criterio: "A cadeira de trabalho regula a altura.", nivel: "trabalho_cadeira_regulavel", testeEmUso: true, aceitaNaoSeAplica: true, reverificacao: "foto" },
  // 6) Limpeza
  { chave: "limpeza_estado", grupo: "limpeza", rotulo: "Estado de limpeza", criterio: "Pronto para morar | precisa de limpeza leve | não habitável.", conforto: "entrega_limpa", tipo: "limpeza", reverificacao: "foto" },
  { chave: "cheiro_mofo", grupo: "limpeza", rotulo: "Cheiro de mofo", criterio: "Teste do cheiro: mofo ausente (conforme) ou presente (não conforme).", conforto: "entrega_limpa", tipo: "cheiro", reverificacao: "visita" },
  { chave: "cheiro_esgoto", grupo: "limpeza", rotulo: "Cheiro de esgoto", criterio: "Teste do cheiro: esgoto ausente ou presente.", conforto: "entrega_limpa", tipo: "cheiro", reverificacao: "visita" },
  { chave: "cheiro_fumaca", grupo: "limpeza", rotulo: "Cheiro de fumaça", criterio: "Teste do cheiro: fumaça ausente ou presente.", conforto: "entrega_limpa", tipo: "cheiro", reverificacao: "visita" },
  { chave: "cheiro_cigarro", grupo: "limpeza", rotulo: "Cheiro de cigarro", criterio: "Teste do cheiro: cigarro ausente ou presente.", conforto: "entrega_limpa", tipo: "cheiro", reverificacao: "visita" },
  // 7) Segurança
  { chave: "fechadura_entrada", grupo: "seguranca", rotulo: "Fechadura da entrada", criterio: "A porta de entrada tranca com a chave e a fechadura funciona.", conforto: "fechadura_entrada", grave: true, testeEmUso: true, reverificacao: "foto" },
  { chave: "cameras_declaracao", grupo: "seguranca", rotulo: "Câmeras conforme a declaração", criterio: "As câmeras conferem com a declaração do anúncio e nenhuma é interna.", reverificacao: "visita" },
  { chave: "detector_extintor", grupo: "seguranca", rotulo: "Detector de fumaça e extintor", criterio: "Registrar se há detector de fumaça e extintor (só registro).", registro: true, aceitaNaoSeAplica: true, reverificacao: "foto" },
  { chave: "gas_vazamento", grupo: "seguranca", rotulo: "Gás sem vazamento aparente", criterio: "Sem cheiro de gás e sem mangueira ou registro danificado.", grave: true, aceitaNaoSeAplica: true, reverificacao: "visita" },
  { chave: "fiacao_exposta", grupo: "seguranca", rotulo: "Sem fiação exposta", criterio: "Nenhum fio exposto ou emenda à vista.", grave: true, reverificacao: "visita" },
  { chave: "tomadas_risco", grupo: "seguranca", rotulo: "Tomadas sem risco visível", criterio: "Tomadas firmes, sem queimado e sem faísca.", reverificacao: "foto" },
  // 8) Internet (medida NA HORA pelo motor do 57)
  { chave: "internet_quarto", grupo: "internet", rotulo: "Internet medida no quarto principal", criterio: "Medição válida no quarto principal, com prova de local.", conforto: "internet_informada", nivel: "internet_medida_quarto", reverificacao: "visita" },
  { chave: "internet_trabalho", grupo: "internet", rotulo: "Internet medida no ponto de trabalho", criterio: "Medição válida no ponto de trabalho, com prova de local.", nivel: "internet_medida_trabalho", aceitaNaoSeAplica: true, reverificacao: "visita" },
  { chave: "internet_videochamada", grupo: "internet", rotulo: "Videochamada no ponto de trabalho", criterio: "A medição do ponto de trabalho passa a regra de videochamada.", nivel: "internet_videochamada_trabalho", aceitaNaoSeAplica: true, reverificacao: "visita" },
  // 9) O que considerar e ruído
  { chave: "considerar_confere", grupo: "ruido", rotulo: "\"O que considerar\" confere", criterio: "O que o anúncio diz em \"O que considerar\" confere com o imóvel.", reverificacao: "visita" },
  { chave: "ruido_classificado", grupo: "ruido", rotulo: "Ruído classificado pelas 4 perguntas", criterio: "As 4 perguntas de exposição respondidas na visita (origem: avaliação).", nivel: "ruido_controlado", reverificacao: "visita" },
] as const satisfies readonly ItemChecklist[];

export type ChaveChecklist = (typeof ITENS_CHECKLIST)[number]["chave"];
export const CHAVES_CHECKLIST: readonly string[] = ITENS_CHECKLIST.map((i) => i.chave);
export const itemChecklist = (chave: string): ItemChecklist | undefined => (ITENS_CHECKLIST as readonly ItemChecklist[]).find((i) => i.chave === chave);
export const CHAVES_GRAVES: readonly string[] = (ITENS_CHECKLIST as readonly ItemChecklist[]).filter((i) => i.grave).map((i) => i.chave);

/** Valores aceitos por item. */
export function valoresDoItem(i: ItemChecklist): ValorItem[] {
  if (i.tipo === "limpeza") return ["pronto", "leve", "nao_habitavel"];
  return i.aceitaNaoSeAplica ? ["conforme", "nao_conforme", "nao_se_aplica"] : ["conforme", "nao_conforme"];
}

export const ROTULO_VALOR: Record<ValorItem, string> = {
  conforme: "Conforme",
  nao_conforme: "Não conforme",
  nao_se_aplica: "Não se aplica",
  pronto: "Pronto para morar",
  leve: "Precisa de limpeza leve",
  nao_habitavel: "Não habitável",
};

/** Texto fixo de delimitação do laudo (item 14 da Dra. Beatriz). */
export const DELIMITACAO_LAUDO =
  "Retrato do estado do imóvel na data da avaliação, pelo checklist da Viva. Não é garantia de condições futuras nem avaliação estrutural ou de engenharia.";
