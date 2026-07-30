import { getPlatformSettings } from "@/lib/platform-settings"
import { parseHelpTutorials, type HelpTutorialsConfig } from "@/lib/help-tutorials"
import { prisma } from "@/lib/prisma"

export async function getHelpTutorialsConfig(opts?: {
  includeInactive?: boolean
}): Promise<HelpTutorialsConfig> {
  const row = await getPlatformSettings()
  return parseHelpTutorials(row.helpTutorials, opts)
}

export async function saveHelpTutorialsConfig(data: HelpTutorialsConfig): Promise<HelpTutorialsConfig> {
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      helpTutorials: data as object,
    },
    update: {
      helpTutorials: data as object,
    },
  })
  return data
}
