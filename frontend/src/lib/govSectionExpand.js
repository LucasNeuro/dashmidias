import { useCallback, useState } from 'react';

/** sessionStorage keys for governance table sections (Controles e acessos). */
export const GOV_SECTION_STORAGE = {
  cargos: 'gov-section:cargos',
  hubAdmins: 'gov-section:hube-admins',
  orgMembers: 'gov-section:org-members',
  solicHubAdmins: 'gov-section:solic-hub-admins',
};

export function readGovSectionOpen(storageKey, defaultOpen = true) {
  try {
    const v = sessionStorage.getItem(storageKey);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch {
    /* ignore */
  }
  return defaultOpen;
}

export function writeGovSectionOpen(storageKey, open) {
  try {
    sessionStorage.setItem(storageKey, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function useGovSectionExpanded(storageKey, defaultOpen = true) {
  const [open, setOpen] = useState(() => readGovSectionOpen(storageKey, defaultOpen));
  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      writeGovSectionOpen(storageKey, next);
      return next;
    });
  }, [storageKey]);
  return [open, toggle];
}
