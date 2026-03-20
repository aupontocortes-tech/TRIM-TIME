import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display, Cormorant_Garamond } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter'
});

const playfair = Playfair_Display({ 
  subsets: ["latin"],
  variable: '--font-playfair'
});

/** Nome da marca — serifada elegante (barbearia premium) */
const trimTimeWordmark = Cormorant_Garamond({
  subsets: ["latin"],
  variable: '--font-trim-time-wordmark',
  weight: ['600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Trim Time - Sistema de Agendamento para Barbearias',
  description: 'A plataforma completa para barbearias. Agendamentos online, gestão financeira e muito mais.',
  keywords: ['barbearia', 'agendamento', 'barber', 'corte', 'cabelo', 'barba', 'Trim Time'],
  manifest: '/manifest.json',
  // Ícones: use app/icon.png e app/apple-icon.png (convenção oficial do Next.js)
}

export const viewport: Viewport = {
  themeColor: '#c9a227',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.variable} ${playfair.variable} ${trimTimeWordmark.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
