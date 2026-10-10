import type { Metadata } from "next";
import Link from "next/link";
import { ExcluirContaForm } from "./form";

export const metadata: Metadata = {
  title: "Excluir conta",
  description:
    "Como excluir sua conta Viva Nomads e todos os seus dados — pelo app ou por este formulário, com confirmação por e-mail.",
  alternates: { canonical: "/excluir-conta" },
  robots: { index: false, follow: true },
};

export default function ExcluirContaPage() {
  return (
    <div className="container-page section-y max-w-2xl">
      <h1 className="display-lg font-title font-bold text-ink">Excluir sua conta</h1>
      <p className="mt-3 text-muted">
        Você pode excluir sua conta do Viva Nomads e todos os dados associados a qualquer momento.
        Há dois caminhos.
      </p>

      <section className="mt-8">
        <h2 className="font-title text-xl font-bold text-ink">1. Pelo app (mais rápido)</h2>
        <p className="mt-2 text-muted">
          Entre na sua conta e vá em <strong className="text-ink">Conta → Excluir conta</strong>.
          A exclusão é imediata e não precisa de confirmação por e-mail.
        </p>
        <Link
          href="/dashboard/conta"
          className="mt-3 inline-flex rounded-xl border border-sage-200 px-4 py-2.5 text-sm font-medium text-forest"
        >
          Abrir Conta
        </Link>
      </section>

      <section className="mt-8">
        <h2 className="font-title text-xl font-bold text-ink">2. Por aqui (sem entrar)</h2>
        <p className="mt-2 text-muted">
          Informe o e-mail da conta. Enviaremos um link de confirmação para esse e-mail; ao
          confirmar, a conta e os dados são apagados.
        </p>
        <div className="mt-4">
          <ExcluirContaForm />
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-sage-200 bg-surface-2 p-5">
        <h2 className="font-title text-lg font-bold text-ink">O que é apagado</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-muted">
          <li>Seu perfil (nome, e-mail, telefone) e suas preferências.</li>
          <li>Seus anúncios, candidaturas, favoritos e buscas salvas.</li>
          <li>Suas conversas e mensagens.</li>
          <li>Contratos, blocos e registros de locação ligados à sua conta.</li>
          <li>Documentos enviados e o token de notificações do aparelho.</li>
        </ul>
        <p className="mt-3 text-sm text-muted">
          <strong className="text-ink">Locação ativa:</strong> se você tiver uma locação ou contrato
          em vigor, a exclusão é <strong className="text-ink">bloqueada</strong> até o encerramento —
          assim preservamos os registros exigidos enquanto o contrato vale.
        </p>
        <p className="mt-2 text-sm text-muted">
          <strong className="text-ink">Histórico de contratos:</strong> se você já teve contratos, em
          vez de apagar tudo, <strong className="text-ink">removemos sua identidade</strong> (nome,
          e-mail, telefone e foto) e encerramos o acesso, mantendo os contratos e pagamentos
          <strong className="text-ink"> sem identificação</strong> pelo prazo exigido por lei.
        </p>
        <p className="mt-2 text-sm text-muted">
          <strong className="text-ink">Prazo:</strong> a ação é feita na hora da confirmação. Cópias
          em backups de segurança são expurgadas em até 30 dias.
        </p>
      </section>

      <p className="mt-8 text-sm text-muted">
        Dúvidas sobre privacidade? Leia a{" "}
        <Link href="/privacidade" className="font-medium text-forest underline">
          Política de Privacidade
        </Link>
        .
      </p>
    </div>
  );
}
