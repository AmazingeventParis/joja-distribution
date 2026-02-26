// API Route : POST /api/auth/change-password
// Permet a un utilisateur connecte de changer son mot de passe
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { comparePassword, hashPassword } from "@/lib/auth";
import { requireAuth, AuthError } from "@/lib/auth-middleware";

// Headers CORS pour acces mobile
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);

    const { currentPassword, newPassword } = await req.json();

    // Validation des champs
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "L'ancien et le nouveau mot de passe sont requis" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Le nouveau mot de passe doit contenir au moins 6 caracteres" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Recuperer le hash actuel depuis la BDD
    const result = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [user.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Verifier l'ancien mot de passe
    const passwordValid = await comparePassword(
      currentPassword,
      result.rows[0].password_hash
    );
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Ancien mot de passe incorrect" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Hasher et sauvegarder le nouveau mot de passe
    const newHash = await hashPassword(newPassword);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      newHash,
      user.userId,
    ]);

    return NextResponse.json(
      { message: "Mot de passe modifie avec succes" },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders }
      );
    }
    console.error("Erreur changement mot de passe:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500, headers: corsHeaders }
    );
  }
}
