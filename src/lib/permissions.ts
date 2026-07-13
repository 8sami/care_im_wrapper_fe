export function hasPermission(permission: string, permissions: string[]) {
  return permissions.includes(permission);
}
