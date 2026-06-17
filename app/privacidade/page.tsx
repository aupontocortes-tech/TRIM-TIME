import type { Metadata } from "next"
import { StaticPageShell } from "@/components/static-page-shell"

export const metadata: Metadata = {
  title: "Política de Privacidade — Trim Time",
  description: "Como o Trim Time coleta, usa e protege seus dados.",
}

export default function PrivacidadePage() {
  return (
    <StaticPageShell title="Política de Privacidade">
      <p>
        Esta política descreve como o Trim Time trata dados pessoais de barbearias, profissionais e clientes
        que utilizam a plataforma.
      </p>

      <h2>1. Dados que coletamos</h2>
      <ul>
        <li>Dados de cadastro: nome, e-mail, telefone e informações da barbearia.</li>
        <li>Dados de agendamento: serviços, horários, profissional e histórico de visitas.</li>
        <li>Dados técnicos: logs, dispositivo e cookies necessários ao funcionamento do serviço.</li>
      </ul>

      <h2>2. Finalidade do tratamento</h2>
      <p>Utilizamos os dados para:</p>
      <ul>
        <li>Operar agendamentos, lembretes e funcionalidades contratadas.</li>
        <li>Autenticar usuários e manter a segurança da plataforma.</li>
        <li>Prestar suporte e melhorar o produto.</li>
        <li>Cumprir obrigações legais.</li>
      </ul>

      <h2>3. Compartilhamento</h2>
      <p>
        Não vendemos dados pessoais. Podemos compartilhar informações com provedores de infraestrutura,
        pagamento, e-mail, WhatsApp e autenticação, apenas na medida necessária para prestar o serviço.
      </p>

      <h2>4. Retenção e segurança</h2>
      <p>
        Mantemos os dados enquanto a conta estiver ativa ou conforme exigido por lei. Adotamos medidas
        técnicas e organizacionais para proteger as informações.
      </p>

      <h2>5. Seus direitos</h2>
      <p>
        Você pode solicitar acesso, correção ou exclusão de dados entrando em contato pelo canal indicado na
        página de <a href="/contato">Contato</a>, conforme a LGPD.
      </p>

      <p className="text-sm pt-4">Última atualização: junho de 2026.</p>
    </StaticPageShell>
  )
}
