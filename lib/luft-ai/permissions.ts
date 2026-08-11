import type { LuftPermission, LuftRole } from "@/types/luft-ai";

const ROLE_PERMISSIONS: Record<LuftRole, LuftPermission[]> = {
  owner: ["project:read", "component:review", "component:propose", "component:approve"],
  technical: ["project:read", "component:review", "component:propose", "component:approve"],
  sales: ["project:read", "component:review"],
  production: ["project:read", "component:review"],
  viewer: ["project:read"],
};

export function hasPermission(role: LuftRole, permission: LuftPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: LuftRole): LuftPermission[] {
  return [...ROLE_PERMISSIONS[role]];
}
