import type { Metadata } from "next"
import { StaticPageShell } from "@/components/static-page-shell"

export const metadata: Metadata = {
  title: "Sobre — Trim Time",
  description: "Conheça o Trim Time, plataforma de agendamento para barbearias.",
}

export default function SobrePage() {
  return (
    <StaticPageShell title="Sobre o Trim Time">
      <p>
        O Trim Time nasceu para simplificar a rotina de barbearias modernas: agendamento online, gestão de
        clientes, equipe, financeiro e comunicação — tudo em um só lugar.
      </p>

      <h2>Nossa missão</h2>
      <p>
        Dar à barbearia um link profissional de agendamento e ferramentas de gestão que cabem no bolso, para
        que o barbeiro foque no que importa: atender bem e crescer o negócio.
      </p>

      <h2>Para quem é</h2>
      <ul>
        <li>Barbearias autônomas e equipes com vários profissionais.</li>
        <li>Redes com múltiplas unidades.</li>
        <li>Clientes que querem agendar pelo celular, sem ligação ou fila de WhatsApp.</li>
      </ul>

      <h2>O que oferecemos</h2>
      <p>
        Link exclusivo de agendamento, painel administrativo, lembretes, lista de espera, controle financeiro,
        comissões, fidelidade e integrações conforme o plano contratado.
      </p>
    </StaticPageShell>
  )
}
