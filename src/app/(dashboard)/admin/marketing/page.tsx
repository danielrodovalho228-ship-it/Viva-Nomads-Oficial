import { listarGastosMarketing } from "@/lib/data/marketing-admin";
import { AdminMarketingClient } from "./admin-marketing-client";
import { tituloDoAdmin } from "@/config/menu-admin";

export const metadata = { title: tituloDoAdmin("/admin/marketing") };

export default async function AdminMarketingPage() {
  const { gastos, aviso } = await listarGastosMarketing();
  return <AdminMarketingClient gastos={gastos} aviso={aviso} />;
}
