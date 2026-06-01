export const appRoles = ['user', 'admin', 'superadmin'] as const;

export type AppRole = (typeof appRoles)[number];
