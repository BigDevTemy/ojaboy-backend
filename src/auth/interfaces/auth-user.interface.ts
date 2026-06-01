export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  authProviders: string[];
}

export interface StoredUser extends AuthUser {
  passwordHash: string | null;
  createdAt: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}
