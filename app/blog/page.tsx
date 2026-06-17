import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Newspaper } from "lucide-react"
import { StaticPageShell } from "@/components/static-page-shell"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Blog — Trim Time",
  description: "Novidades e conteúdos sobre gestão de barbearias.",
}

const comingSoonLinks = [
  {
    title: "Funcionalidades",
    description: "Veja tudo que o Trim Time oferece para sua barbearia.",
    href: "/#funcionalidades",
  },
  {
    title: "Planos e preços",
    description: "Compare Básico, Pro e Premium e comece com 7 dias grátis.",
    href: "/#planos",
  },
  {
    title: "Fale conosco",
    description: "Tire dúvidas sobre cadastro, planos ou suporte.",
    href: "/contato",
  },
]

export default function BlogPage() {
  return (
    <StaticPageShell title="Blog">
      <div className="flex items-start gap-4 rounded-xl border border-border bg-card/50 p-5 mb-8 not-prose">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Newspaper className="h-5 w-5" />
        </div>
        <div>
          <p className="text-foreground font-medium mb-1">Em breve</p>
          <p className="text-sm text-muted-foreground">
            Artigos sobre gestão de barbearias, marketing, retenção de clientes e novidades do Trim Time.
          </p>
        </div>
      </div>

      <h2 className="!mt-0">Enquanto isso</h2>
      <div className="grid gap-4 not-prose">
        {comingSoonLinks.map((item) => (
          <Link key={item.href} href={item.href} className="group block">
            <Card className="bg-card border-border transition-colors hover:border-primary/40">
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {item.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </StaticPageShell>
  )
}
