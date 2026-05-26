import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Bell,
  Building2,
  Calendar,
  Clock,
  Gift,
  ListOrdered,
  MessageCircle,
  Scissors,
  Shield,
  Smartphone,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react"

export type LandingFeature = {
  icon: LucideIcon
  title: string
  /** Texto curto no carrossel do hero. */
  descriptionShort: string
  /** Texto completo na grade de funcionalidades. */
  description: string
  /** Classes Tailwind para o ícone (fundo + texto). */
  accent: {
    ring: string
    bg: string
    icon: string
    glow: string
  }
}

const ACCENTS: LandingFeature["accent"][] = [
  {
    ring: "ring-amber-500/40",
    bg: "bg-gradient-to-br from-amber-500/25 to-amber-600/10",
    icon: "text-amber-400",
    glow: "shadow-[0_0_40px_rgba(245,158,11,0.25)]",
  },
  {
    ring: "ring-blue-500/40",
    bg: "bg-gradient-to-br from-blue-500/25 to-blue-600/10",
    icon: "text-blue-400",
    glow: "shadow-[0_0_40px_rgba(59,130,246,0.25)]",
  },
  {
    ring: "ring-emerald-500/40",
    bg: "bg-gradient-to-br from-emerald-500/25 to-emerald-600/10",
    icon: "text-emerald-400",
    glow: "shadow-[0_0_40px_rgba(16,185,129,0.25)]",
  },
  {
    ring: "ring-violet-500/40",
    bg: "bg-gradient-to-br from-violet-500/25 to-violet-600/10",
    icon: "text-violet-400",
    glow: "shadow-[0_0_40px_rgba(139,92,246,0.25)]",
  },
  {
    ring: "ring-rose-500/40",
    bg: "bg-gradient-to-br from-rose-500/25 to-rose-600/10",
    icon: "text-rose-400",
    glow: "shadow-[0_0_40px_rgba(244,63,94,0.2)]",
  },
  {
    ring: "ring-cyan-500/40",
    bg: "bg-gradient-to-br from-cyan-500/25 to-cyan-600/10",
    icon: "text-cyan-400",
    glow: "shadow-[0_0_40px_rgba(34,211,238,0.2)]",
  },
]

function withAccents(
  items: Omit<LandingFeature, "accent">[]
): LandingFeature[] {
  return items.map((item, i) => ({
    ...item,
    accent: ACCENTS[i % ACCENTS.length]!,
  }))
}

/** Funcionalidades exibidas no hero (carrossel) e na seção #funcionalidades. */
export const LANDING_FEATURES: LandingFeature[] = withAccents([
  {
    icon: Calendar,
    title: "Seu Link Exclusivo",
    descriptionShort:
      "Link exclusivo: o cliente escolhe serviço e horário; você vê tudo na agenda.",
    description:
      "Receba um link (trimtime.com/b/sua-barbearia) e compartilhe com seus clientes. O cliente entra, escolhe serviço e horário, e agenda. Você tem acesso à agenda com horário, nome do cliente e tudo sobre cada agendamento.",
  },
  {
    icon: TrendingUp,
    title: "Gestão Financeira",
    descriptionShort: "Faturamento e relatórios diários e mensais na palma da mão.",
    description:
      "Controle de faturamento, relatórios de vendas diárias e mensais. Saiba exatamente quanto sua barbearia está faturando.",
  },
  {
    icon: Users,
    title: "Gestão de Clientes",
    descriptionShort: "Histórico, preferências e frequência de cada cliente.",
    description:
      "Histórico completo de cada cliente, preferências, frequência de visitas e muito mais.",
  },
  {
    icon: Clock,
    title: "Controle de Horários",
    descriptionShort: "Horários, folgas e pausas — a grade se organiza sozinha.",
    description:
      "Defina seus horários de trabalho, folgas e pausas. O sistema organiza automaticamente.",
  },
  {
    icon: Shield,
    title: "Segurança Total",
    descriptionShort: "Backups automáticos e dados criptografados.",
    description:
      "Seus dados protegidos com a mais alta tecnologia. Backups automáticos e criptografia.",
  },
  {
    icon: Scissors,
    title: "Multi-Barbeiros",
    descriptionShort: "Cada profissional com agenda e comissão próprias.",
    description:
      "Adicione quantos profissionais precisar. Cada um com sua própria agenda e comissões.",
  },
  {
    icon: Bell,
    title: "Lembretes automáticos",
    descriptionShort: "Push, e-mail ou WhatsApp — menos cliente faltando.",
    description:
      "O cliente recebe lembretes antes do horário marcado para não esquecer do agendamento. Confirmação automática ao agendar e opção de lembrete por push, e-mail ou WhatsApp, reduzindo faltas e deixando sua agenda mais previsível.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp Business",
    descriptionShort: "Confirmações e lembretes na API oficial do WhatsApp.",
    description:
      "Integração com a API oficial do WhatsApp para confirmações, lembretes e mensagens pós-atendimento — seus clientes são avisados no app que já usam todo dia.",
  },
  {
    icon: ListOrdered,
    title: "Lista de espera",
    descriptionShort: "Vaga abriu? Quem estava na fila é avisado na hora.",
    description:
      "Quando um horário abre, o sistema avisa quem estava na fila. Menos buracos na agenda e clientes que não desistem de cortar com você.",
  },
  {
    icon: Wallet,
    title: "Comissão por barbeiro",
    descriptionShort: "Percentual e resultado de cada profissional.",
    description:
      "Defina o percentual de cada profissional e acompanhe quanto cada um gerou. Ideal para equipes com mais de um cadeira.",
  },
  {
    icon: Gift,
    title: "Programa de fidelidade",
    descriptionShort: "Pontos por visita para o cliente voltar sempre.",
    description:
      "Pontos por visita para seus clientes voltarem. Recompense quem agenda com frequência e fortaleça o relacionamento com a barbearia.",
  },
  {
    icon: Building2,
    title: "Várias unidades",
    descriptionShort: "Várias lojas, agendas separadas, uma só conta.",
    description:
      "Gerencie mais de uma loja na mesma conta: cada unidade com agenda, contato e endereço, sem misturar os agendamentos.",
  },
  {
    icon: BarChart3,
    title: "Dashboard e relatórios",
    descriptionShort: "Visão clara de agendamentos, faturamento e pico.",
    description:
      "Visão clara do negócio: agendamentos, faturamento e desempenho. Relatórios que ajudam a decidir preço, equipe e horários de pico.",
  },
  {
    icon: Smartphone,
    title: "App no celular do cliente",
    descriptionShort: "PWA: agenda e atalho na tela inicial, sem loja de apps.",
    description:
      "Seu link vira experiência de app no celular do cliente (PWA): ele agenda, recebe lembretes e pode instalar na tela inicial sem baixar da loja.",
  },
  {
    icon: UserPlus,
    title: "Equipe por convite",
    descriptionShort: "Convite com link — barbeiro entra com foto e app próprio.",
    description:
      "Envie link de cadastro para novos barbeiros. Eles entram com foto, dados e app próprio para ver a própria agenda e comissão.",
  },
])
