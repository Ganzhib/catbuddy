export interface StoredUser {
  email: string
  passwordHash: string
  createdAt: string
}

/** Registered web user accounts (MySQL). */
export interface UserStore {
  findByEmail(email: string): Promise<StoredUser | null>
  create(email: string, passwordHash: string): Promise<StoredUser>
}
