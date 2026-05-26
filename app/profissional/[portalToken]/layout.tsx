import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Trim Time — App do profissional",
  description: "Agenda e lista de espera",
  robots: { index: false, follow: false },
}

export default function ProfissionalLayout({ children }: { children: ReactNode }) {
  return children
}
