/** Textos padrão de notificações (app, WhatsApp, e-mail). */

const UNIT_BLOCK = "Unidade: {{unidade}}\nEndereço: {{endereco}}\n{{maps}}"

export const DEFAULT_APP_REMINDER =
  `Olá {{nome_cliente}}! Lembrete: você tem {{servico}} em {{data}} às {{horario}} na {{unidade}}.\n${UNIT_BLOCK}`

export const DEFAULT_APP_CONFIRMATION =
  `Olá {{nome_cliente}}, confirmado para {{data}} às {{horario}} — {{servico}} com {{barbeiro}}.\n${UNIT_BLOCK}`

export const DEFAULT_APP_POST_SERVICE =
  "Obrigado pela preferência, {{nome_cliente}}! Esperamos você novamente na {{unidade}}."

export const DEFAULT_WHATSAPP_REMINDER =
  `Olá {{nome_cliente}}, lembrete do seu horário em {{data}} às {{horario}} — {{servico}} na {{unidade}}.\n${UNIT_BLOCK}`

export const DEFAULT_WHATSAPP_CONFIRMATION =
  `Olá {{nome_cliente}}, confirmado para {{data}} às {{horario}} — {{servico}} com {{barbeiro}}.\n${UNIT_BLOCK}`

export const DEFAULT_WHATSAPP_POST_SERVICE =
  "Obrigado pela preferência, {{nome_cliente}}! Esperamos você novamente na {{unidade}}."

export const DEFAULT_EMAIL_REMINDER =
  `Olá {{nome_cliente}}! Lembrete: você tem {{servico}} em {{data}} às {{horario}} na {{unidade}}.\n${UNIT_BLOCK}`

export const DEFAULT_EMAIL_CONFIRMATION =
  `Olá {{nome_cliente}}, seu horário está confirmado para {{data}} às {{horario}} — {{servico}} com {{barbeiro}}.\n${UNIT_BLOCK}`

export const DEFAULT_EMAIL_POST_SERVICE =
  "Obrigado pela preferência, {{nome_cliente}}! Esperamos você novamente na {{unidade}}."

export const DEFAULT_WHATSAPP_WAITLIST_SLOT =
  "Olá {{nome_cliente}}! Uma vaga abriu para {{data}} às {{horario}} — {{servico}} com {{barbeiro}}.\n\nConfirme em até {{prazo_minutos}} minutos:\n{{link_confirmar}}"

export const DEFAULT_EMAIL_WAITLIST_SLOT =
  "Olá {{nome_cliente}}! Uma vaga abriu para {{data}} às {{horario}} — {{servico}} com {{barbeiro}}.\n\nConfirme em até {{prazo_minutos}} minutos:\n{{link_confirmar}}"

export const DEFAULT_APP_WAITLIST_SLOT =
  "Vaga disponível: {{data}} às {{horario}} — {{servico}} com {{barbeiro}}. Confirme em até {{prazo_minutos}} min!"

export const DEFAULT_WHATSAPP_INACTIVE_FIRST =
  "Olá {{nome_cliente}}! Tudo bem?\n\nAqui é da {{barbearia}}. Sentimos sua falta — já faz {{dias_sem_visita}} dias desde sua última visita e adoraríamos te ver de novo.\n\nQuando quiser voltar, é só agendar pelo link:\n{{link_agendamento}}\n\nEstamos te esperando!"

export const DEFAULT_WHATSAPP_INACTIVE_SECOND =
  "Oi {{nome_cliente}}, tudo bem?\n\nPassamos aqui da {{barbearia}} para lembrar que faz um tempinho que você não aparece. Seria um prazer te receber de novo!\n\nAgende no horário que preferir:\n{{link_agendamento}}\n\nEsperamos você em breve!"
