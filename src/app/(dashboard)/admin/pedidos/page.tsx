import { adminListPedidos } from "@/lib/data/pedidos-admin";
import { AdminPedidosClient } from "./admin-pedidos-client";

export default async function AdminPedidosPage() {
  const pedidos = await adminListPedidos();
  return <AdminPedidosClient pedidos={pedidos} />;
}
