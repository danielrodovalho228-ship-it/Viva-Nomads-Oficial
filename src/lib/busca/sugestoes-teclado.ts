// E884: Esc fecha a lista de sugestões de um campo com autocomplete; as outras teclas não mudam o estado.
export function abertoAposTecla(tecla: string, aberto: boolean): boolean {
  if (tecla === "Escape") return false;
  return aberto;
}
