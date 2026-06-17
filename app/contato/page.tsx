import type { Metadata } from "next"
import Link from "next/link"
import { StaticPageShell } from "@/components/static-page-shell"
import { buildLandingWhatsappUrl, getLandingWhatsappPhone } from "@/lib/platform-settings"

export const metadata: Metadata = {
  title: "Contato — Trim Time",
  description: "Entre em contato com a equipe Trim Time.",
}

export default async function ContatoPage() {
  const phone = await getLandingWhatsappPhone().catch(() => null)
  const whatsappUrl = phone ? buildLandingWhatsappUrl(phone) : null

  return (
    <StaticPageShell title="Contato">
      <p>
        Tem dúvidas sobre planos, cadastro ou suporte? Fale conosco pelos canais abaixo.
      </p>

      <h2>WhatsApp</h2>
      {whatsappUrl ? (
        <p>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            Chamar no WhatsApp
          </a>
        </p>
      ) : (
        <p className="text-sm">
          O WhatsApp de atendimento será exibido aqui assim que estiver configurado na plataforma.
        </p>
      )}

      <h2>Barbearias cadastradas</h2>
      <p>
        Se você já é cliente Trim Time, use o suporte dentro do{" "}
        <Link href="/login">painel da barbearia</Link> ou o chat de suporte disponível no seu plano.
      </p>

      <h2>Agendamento como cliente final</h2>
      <p>
        Para marcar horário, use o link enviado pela sua barbearia (ex.:{" "}
        <Link href="/b/trim-time">/b/nome-da-barbearia</Link>). O Trim Time não agenda em nome de barbearias
        pelo site principal.
      </p>
    </StaticPageShell>
  )
}
