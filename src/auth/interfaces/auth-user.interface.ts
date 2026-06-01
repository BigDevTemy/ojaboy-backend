export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export interface StoredUser extends AuthUser {
  passwordHash: string;
  createdAt: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}
