/** @param {string | null | undefined} userId */
export function registrationTemplatesListQueryKey(userId) {
  return ['registration_form_templates', userId];
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

/** @param {string | null | undefined} flowSlug */
export function masterFlowPublicQueryKey(flowSlug) {
  return ['hub_registration_master_flow', 'public', flowSlug ?? null];
}

/** Admin: todos os fluxos. */
export function masterFlowsAdminQueryKey() {
  return ['hub_registration_master_flow', 'admin', 'list'];
}

/** @param {string | null | undefined} masterFlowId */
export function masterFlowStepsAdminQueryKey(masterFlowId) {
  return ['hub_registration_master_flow_step', 'admin', masterFlowId ?? null];
}
