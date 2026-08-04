"use client"

import { useState } from "react"
import { Check, Copy, ExternalLink, Link2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type WhatsAppGreenApiWebhookCardProps = {
  webhookUrl: string
}

export function WhatsAppGreenApiWebhookCard({ webhookUrl }: WhatsAppGreenApiWebhookCardProps) {
  const [copied, setCopied] = useState(false)
  const isLocalhost =
    webhookUrl.includes("localhost") || webhookUrl.includes("127.0.0.1")

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <Card className="border-amber-500/35 bg-amber-500/5 max-w-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-foreground flex items-center gap-2">
          <Link2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          Passo necessário: webhook no Green API
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Para o WhatsApp <strong className="text-foreground font-medium">responder o cliente sozinho</strong>,
          cole esta URL no painel da Green API. Sem isso, as respostas automáticas não funcionam.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
          <li>
            Abra{" "}
            <a
              href="https://console.green-api.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium hover:underline inline-flex items-center gap-1"
            >
              console.green-api.com
              <ExternalLink className="h-3 w-3" />
            </a>
          </li>
          <li>Entre na sua instância do WhatsApp</li>
          <li>Vá em <strong className="text-foreground">Configurações</strong></li>
          <li>Cole a URL abaixo no campo de webhook e salve</li>
        </ol>

        <div className="flex flex-col sm:flex-row gap-2">
          <code className="flex-1 break-all rounded-lg border border-border bg-background px-3 py-2.5 text-xs text-foreground font-mono">
            {webhookUrl}
          </code>
          <Button type="button" variant="outline" className="shrink-0 border-border" onClick={() => void handleCopy()}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1.5 text-green-600" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1.5" />
                Copiar URL
              </>
            )}
          </Button>
        </div>

        {isLocalhost ? (
          <p className="text-xs text-amber-700 dark:text-amber-400 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            Você está no <strong className="font-medium">localhost</strong> — essa URL só vale para testes no seu
            computador. No site publicado (trimtime.pro), abra Configurações → Integração de novo e copie a URL de
            produção.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
