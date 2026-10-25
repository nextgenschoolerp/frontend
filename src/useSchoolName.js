import { useAuth } from './auth.jsx';
import { useApi } from './api/useApi.js';
import { getSchoolProfile } from './api/authService.js';

/** The school's name from its profile, for titles and documents; the product name until the profile loads. */
export function useSchoolName() {
  const { user } = useAuth();
  const profile = useApi(() => getSchoolProfile(user.tenantId), [user?.tenantId], !!user?.tenantId);
  return profile.data?.schoolName || 'School ERP';
}
