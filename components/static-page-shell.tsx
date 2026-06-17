import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/brand-logo"
import { TrimTimeWordmark } from "@/components/trim-time-wordmark"
import { StaticPageFooter } from "@/components/static-page-footer"

type StaticPageShellProps = {
  title: string
  children: React.ReactNode
}

export function StaticPageShell({ title, children }: StaticPageShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-3 min-w-0 focus:outline-none focus:ring-2 focus:ring-primary rounded-lg transition-opacity hover:opacity-90"
          >
            <BrandLogo size="md" withBorder={false} priority={false} />
            <TrimTimeWordmark className="text-xl shrink-0 leading-none" />
          </Link>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/">Início</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="text-3xl font-bold text-foreground mb-8">{title}</h1>
        <div className="prose prose-invert max-w-none text-muted-foreground space-y-4 [&_h2]:text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-primary [&_a]:underline">
          {children}
        </div>
      </main>
      <StaticPageFooter />
    </div>
  )
}
