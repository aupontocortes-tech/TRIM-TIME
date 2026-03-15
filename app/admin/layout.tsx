"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Shield, Store, LogOut } from "lucide-react"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    fetch("/api/barbershops")
      .then((r) => r.json())
      .then((data) => {
        if (data?.role === "admin") setAllowed(true)
        else setAllowed(false)
      })
      .catch(() => setAllowed(false))
  }, [])

  useEffect(() => {
    if (allowed === false) router.replace("/")
  }, [allowed, router])

  if (allowed === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Shield className="w-10 h-10 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Verificando acesso...</p>
        </div>
      </div>
    )
  }

  if (!allowed) return null

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2 font-semibold text-foreground">
              <Shield className="w-6 h-6 text-amber-500" />
              Painel Admin
            </Link>
            <nav className="flex gap-4">
              <Link
                href="/admin"
                className={`text-sm font-medium transition-colors hover:text-foreground ${pathname === "/admin" ? "text-foreground" : "text-muted-foreground"}`}
              >
                Dashboard
              </Link>
              <Link
                href="/admin/barbershops"
                className={`text-sm font-medium transition-colors hover:text-foreground ${pathname.startsWith("/admin/barbershops") ? "text-foreground" : "text-muted-foreground"}`}
              >
                Barbearias
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/painel"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Minha barbearia
            </Link>
            <button
              onClick={() => router.push("/login")}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
