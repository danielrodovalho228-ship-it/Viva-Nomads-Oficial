import { adminListPedidos, getMetricasPedidosAdmin } from "@/lib/data/pedidos-admin";
import { AdminPedidosClient } from "./admin-pedidos-client";

export default async function AdminPedidosPage() {
  const [pedidos, metricas] = await Promise.all([adminListPedidos(), getMetricasPedidosAdmin()]);
  return <AdminPedidosClient pedidos={pedidos} metricas={metricas} />;
}
