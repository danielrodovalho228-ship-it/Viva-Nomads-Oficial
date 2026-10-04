import { listarGastosMarketing } from "@/lib/data/marketing-admin";
import { AdminMarketingClient } from "./admin-marketing-client";

export const metadata = { title: "Marketing — Admin" };

export default async function AdminMarketingPage() {
  const { gastos, aviso } = await listarGastosMarketing();
  return <AdminMarketingClient gastos={gastos} aviso={aviso} />;
}
