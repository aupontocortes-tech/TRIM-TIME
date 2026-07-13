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
