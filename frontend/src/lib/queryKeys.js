/**
 * @param {string | null | undefined} userId
 * @param {'partner_homologacao' | 'lead_capture'} [purpose]
 */
export function registrationTemplatesListQueryKey(userId, purpose = 'partner_homologacao') {
  return ['registration_form_templates', userId, purpose];
}

/** @param {string | null | undefined} tplId */
export function registrationTemplateDetailQueryKey(tplId) {
  return ['registration_form_template', tplId];
}

/** @param {string} scope @param {string | null | undefined} [userId] */
export function hubStandardCatalogQueryKey(scope, userId) {
  return ['hub_standard_catalog', scope, userId ?? null];
}

/** Segmentos públicos de lead (hub_lead_segment). */
export function leadSegmentsPublicQueryKey() {
  return ['hub_lead_segment', 'public_active'];
}
