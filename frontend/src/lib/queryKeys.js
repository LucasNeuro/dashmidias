/** @param {string | null | undefined} userId */
export function registrationTemplatesListQueryKey(userId) {
  return ['registration_form_templates', userId];
}

/** @param {string | null | undefined} tplId */
export function registrationTemplateDetailQueryKey(tplId) {
  return ['registration_form_template', tplId];
}
