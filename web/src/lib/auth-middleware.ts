// Middleware d'authentification pour les API routes Next.js
// Extrait l'utilisateur depuis le header Authorization ou le cookie joja_token
import { NextRequest } from "next/server";
import { verifyToken, JwtPayload } from "@/lib/auth";

/**
 * Extraire l'utilisateur authentifie depuis la requete
 * Verifie dans l'ordre : header Authorization Bearer, puis cookie joja_token
 * Retourne le payload JWT ou null si non authentifie
 */
export function getUserFromRequest(req: NextRequest): JwtPayload | null {
  // 1) Verifier le header Authorization: Bearer <token>
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) return payload;
  }

  // 2) Verifier le cookie joja_token
  const cookieToken = req.cookies.get("joja_token")?.value;
  if (cookieToken) {
    const payload = verifyToken(cookieToken);
    if (payload) return payload;
  }

  // 3) Verifier le query param ?token=... (pour les liens ouverts dans le navigateur externe, ex: PDF mobile)
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken) {
    const payload = verifyToken(queryToken);
    if (payload) return payload;
  }

  return null;
}

/**
 * Exiger une authentification valide
 * Lance une erreur si l'utilisateur n'est pas connecte
 */
export function requireAuth(req: NextRequest): JwtPayload {
  const user = getUserFromRequest(req);
  if (!user) {
    throw new AuthError("Non authentifie", 401);
  }
  return user;
}

/**
 * Exiger le role admin
 * Lance une erreur si l'utilisateur n'est pas admin
 */
export function requireAdmin(req: NextRequest): JwtPayload {
  const user = requireAuth(req);
  if (user.role !== "admin") {
    throw new AuthError("Acces reserve aux administrateurs", 403);
  }
  return user;
}

/**
 * Classe d'erreur personnalisee pour l'authentification
 * Permet de transporter le code HTTP avec le message
 */
export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}
