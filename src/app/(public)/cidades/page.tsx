import { permanentRedirect } from "next/navigation";

// /cidades respondia 404. Hoje só há Uberlândia: redireciona (308) para a página da cidade.
// Quando houver mais de uma cidade, trocar por uma lista.
export default function CidadesPage() {
  permanentRedirect("/cidades/uberlandia");
}
