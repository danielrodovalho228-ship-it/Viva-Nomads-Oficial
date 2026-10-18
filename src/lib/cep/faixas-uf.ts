/*
  Faixas de CEP por UF (prompt 25). Fonte: Correios — "Faixa de CEP por UF"
  (https://buscacepinter.correios.com.br/app/faixa_cep_uf_localidade/index.php), 5 primeiros dígitos.
  Serve para conferir a resposta da BrasilAPI: ela devolveu "Avenida das Torres, Sarandi/PR" para 99999-999,
  e 99xxx é RS — resposta impossível, tratada como "não encontrado".
*/
const FAIXAS: readonly [uf: string, de: number, ate: number][] = [
  ["SP", 1000, 19999],
  ["RJ", 20000, 28999],
  ["ES", 29000, 29999],
  ["MG", 30000, 39999],
  ["BA", 40000, 48999],
  ["SE", 49000, 49999],
  ["PE", 50000, 56999],
  ["AL", 57000, 57999],
  ["PB", 58000, 58999],
  ["RN", 59000, 59999],
  ["CE", 60000, 63999],
  ["PI", 64000, 64999],
  ["MA", 65000, 65999],
  ["PA", 66000, 68899],
  ["AP", 68900, 68999],
  ["AM", 69000, 69299],
  ["RR", 69300, 69399],
  ["AM", 69400, 69899],
  ["AC", 69900, 69999],
  ["DF", 70000, 72799],
  ["GO", 72800, 72999],
  ["DF", 73000, 73699],
  ["GO", 73700, 76799],
  ["RO", 76800, 76999],
  ["TO", 77000, 77999],
  ["MT", 78000, 78899],
  ["MS", 79000, 79999],
  ["PR", 80000, 87999],
  ["SC", 88000, 89999],
  ["RS", 90000, 99999],
];

/** UF da faixa do CEP (8 dígitos) ou null se fora de qualquer faixa. */
export function ufDaFaixa(cep8: string): string | null {
  if (!/^\d{8}$/.test(cep8)) return null;
  const p = Number(cep8.slice(0, 5));
  return FAIXAS.find(([, de, ate]) => p >= de && p <= ate)?.[0] ?? null;
}

/** A UF devolvida bate com a faixa do CEP? */
export function ufBateComCep(cep8: string, uf: string): boolean {
  const esperada = ufDaFaixa(cep8);
  return !!esperada && esperada === uf.trim().toUpperCase();
}
