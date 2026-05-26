import type { Metadata } from "next"
import PainelLayout from "./painel-shell"

/**
 * Manifest do PWA do barbeiro (start_url /painel) só neste segmento —
 * a landing pública não deve herdar instalabilidade do painel.
 */
export const metadata: Metadata = {
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Trim Time - Painel",
    statusBarStyle: "black-translucent",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PainelLayout>{children}</PainelLayout>
}
