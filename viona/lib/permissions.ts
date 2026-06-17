export type Role = 'admin' | 'manager' | 'employee';

export const OrderPermissions = {
  view: ['admin', 'manager', 'employee'],
  add: ['admin', 'manager', 'employee'],
  edit: ['admin', 'manager'],
  delete: ['admin', 'manager'],
  bulkUpdate: ['admin', 'manager'],
  export: ['admin', 'manager'],
  viewStats: ['admin', 'manager'],
};

export function can(role: Role | null, allowed: Role[]) {
  if (!role) return false;
  if (role === 'admin') return true;
  return allowed.includes(role);
}
