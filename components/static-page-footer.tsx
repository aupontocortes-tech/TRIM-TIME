import Link from "next/link"
import { BrandLogo } from "@/components/brand-logo"

export function StaticPageFooter() {
  return (
    <footer className="border-t border-border mt-16 py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 mb-8">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="inline-flex mb-3 focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
              <BrandLogo size="md" withBorder={false} priority={false} />
            </Link>
            <p className="text-sm text-muted-foreground">
              A plataforma completa para gestão de barbearias.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-3 text-sm">Empresa</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/sobre" className="hover:text-primary transition-colors">Sobre</Link></li>
              <li><Link href="/contato" className="hover:text-primary transition-colors">Contato</Link></li>
              <li><Link href="/blog" className="hover:text-primary transition-colors">Blog</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-3 text-sm">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/termos" className="hover:text-primary transition-colors">Termos de Uso</Link></li>
              <li><Link href="/privacidade" className="hover:text-primary transition-colors">Privacidade</Link></li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center border-t border-border pt-6">
          © {new Date().getFullYear()} Trim Time. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}
