import type { Metadata } from "next"

type Props = {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

/**
 * Na página pública de agendamento, o manifest aponta para este slug
 * (app instalado do cliente abre direto em /b/[slug]).
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const encoded = encodeURIComponent(slug)
  return {
    manifest: `/api/public/pwa-manifest-client?slug=${encoded}`,
    appleWebApp: {
      capable: true,
      title: "Agendar",
      statusBarStyle: "black-translucent",
    },
  }
}

export default function PublicBookingLayout({ children }: Props) {
  return children
}
