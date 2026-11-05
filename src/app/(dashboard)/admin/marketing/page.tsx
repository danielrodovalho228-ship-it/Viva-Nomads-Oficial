import { soLeituraNaTela } from "@/lib/qa/observador";
import { SoLeituraQa } from "@/components/admin/so-leitura-qa";
import { listarGastosMarketing } from "@/lib/data/marketing-admin";
import { AdminMarketingClient } from "./admin-marketing-client";
import { tituloDoAdmin } from "@/config/menu-admin";

export const metadata = { title: tituloDoAdmin("/admin/marketing") };

export default async function AdminMarketingPage() {
  const { gastos, aviso } = await listarGastosMarketing();
  // E477: lançar/apagar gasto é configuração da plataforma — o admin observador da QA só lê.
  const soLeitura = (await soLeituraNaTela([{ id: "configuracao" }])).length > 0;
  return (
    <>
      {soLeitura && <SoLeituraQa className="mb-4" />}
      <AdminMarketingClient gastos={gastos} aviso={aviso} soLeitura={soLeitura} />
    </>
  );
}
