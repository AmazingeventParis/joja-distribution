// Utilitaires d'authentification : JWT + bcrypt
// Remplace Supabase Auth pour la gestion des tokens et mots de passe
import jwt from "jsonwebtoken";
import { hash as bcryptHash, compare as bcryptCompare } from "bcryptjs";

// Type du payload JWT
export interface JwtPayload {
  userId: string;
  email: string;
  role: "admin" | "driver";
  name: string;
}

// Secret JWT depuis les variables d'environnement
const JWT_SECRET = process.env.JWT_SECRET || "joja-fallback-secret-change-me";

// Duree de validite du token : 7 jours
const TOKEN_EXPIRY = "7d";

/**
 * Generer un token JWT a partir d'un payload utilisateur
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verifier et decoder un token JWT
 * Retourne le payload ou null si invalide/expire
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Hasher un mot de passe avec bcrypt (12 rounds)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcryptHash(password, 12);
}

/**
 * Comparer un mot de passe en clair avec son hash bcrypt
 */
export async function comparePassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcryptCompare(password, passwordHash);
}
