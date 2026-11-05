/*
  E605: o texto da confirmação ao DESLIGAR o "Mostrar" de um lugar de "O que tem por perto" (padrão TOGGLE, C9/E56:
  desligar o que está valendo pede confirmação na própria tela). PURO.
  Roda: node --test src/lib/anuncio/e605-mostrar-confirma.test.ts
*/
export function textoConfirmarOcultarLugar(nome: string): string {
  return `Tirar “${nome.trim()}” do anúncio? Ele deixa de aparecer em “O que tem por perto”.`;
}
