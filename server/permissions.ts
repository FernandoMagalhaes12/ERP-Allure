export const ADMIN_PERMISSIONS = ["*"];

export const SELLER_DEFAULT_PERMISSIONS = [
  "sales.view",
  "sales.create",
  "products.view",
  "clients.view",
  "settings.labels.view",
  "settings.labels.print",
  "settings.labels.manage",
];

export const ACCOUNTANT_DEFAULT_PERMISSIONS = [
  "financial.view",
  "fiscal.view",
  "fiscal.manage",
  "fiscal.emit",
  "accountant.view",
  "accountant.export",
  "clients.view",
];

function mergePermissions(base: string[], extra: string[]) {
  return Array.from(new Set([...base, ...extra]));
}

function parsePermissionList(permissions?: unknown) {
  if (Array.isArray(permissions) && permissions.length > 0) {
    return permissions.map((item) => String(item));
  }

  if (typeof permissions === "string" && permissions.trim()) {
    try {
      const parsed = JSON.parse(permissions);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map((item) => String(item));
    } catch {
      return permissions.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }

  return [] as string[];
}

export function normalizePermissions(role: string, permissions?: unknown) {
  const parsed = parsePermissionList(permissions);
  if (role === "admin") return mergePermissions(ADMIN_PERMISSIONS, parsed);
  if (role === "contador") return mergePermissions(ACCOUNTANT_DEFAULT_PERMISSIONS, parsed);
  return mergePermissions(SELLER_DEFAULT_PERMISSIONS, parsed);
}
