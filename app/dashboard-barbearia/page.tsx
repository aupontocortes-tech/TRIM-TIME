import { redirect } from "next/navigation"

/** Rota pedida no spec; o painel real continua em `/painel`. */
export default function DashboardBarbeariaRedirectPage() {
  redirect("/painel")
}
