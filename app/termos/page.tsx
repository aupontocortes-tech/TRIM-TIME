import type { Metadata } from "next"
import { StaticPageShell } from "@/components/static-page-shell"

export const metadata: Metadata = {
  title: "Termos de Uso — Trim Time",
  description: "Termos de uso da plataforma Trim Time para barbearias e clientes.",
}

export default function TermosPage() {
  return (
    <StaticPageShell title="Termos de Uso">
      <p>
        Ao criar uma conta ou utilizar o Trim Time, você concorda com estes termos. Leia com atenção antes de
        usar a plataforma.
      </p>

      <h2>1. O serviço</h2>
      <p>
        O Trim Time é uma plataforma de agendamento e gestão para barbearias. Barbearias contratam planos
        mensais; clientes finais utilizam o link de agendamento da barbearia sem custo adicional pela
        plataforma.
      </p>

      <h2>2. Conta e responsabilidades</h2>
      <ul>
        <li>Você é responsável por manter seus dados de acesso em sigilo.</li>
        <li>Informações cadastradas devem ser verdadeiras e atualizadas.</li>
        <li>O uso indevido da plataforma pode resultar em suspensão da conta.</li>
      </ul>

      <h2>3. Planos e pagamentos</h2>
      <p>
        Planos, preços e período de teste gratuito são informados no site e no painel. Cobranças recorrentes
        seguem o plano escolhido após o período promocional, quando aplicável.
      </p>

      <h2>4. Conteúdo e dados</h2>
      <p>
        A barbearia é responsável pelos dados de clientes, serviços e agendamentos inseridos na plataforma. O
        Trim Time atua como operador tecnológico conforme descrito na{" "}
        <a href="/privacidade">Política de Privacidade</a>.
      </p>

      <h2>5. Disponibilidade</h2>
      <p>
        Buscamos alta disponibilidade, mas não garantimos funcionamento ininterrupto. Manutenções e
        indisponibilidades de terceiros podem ocorrer.
      </p>

      <h2>6. Alterações</h2>
      <p>
        Estes termos podem ser atualizados. O uso continuado após alterações constitui aceite da nova versão.
      </p>

      <p className="text-sm pt-4">Última atualização: junho de 2026.</p>
    </StaticPageShell>
  )
}
