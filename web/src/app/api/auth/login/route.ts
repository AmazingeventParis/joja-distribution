// API Route : POST /api/auth/login
// Authentification par email + mot de passe (bcrypt)
// Retourne un token JWT + set un cookie HttpOnly pour le web
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { comparePassword, signToken } from "@/lib/auth";

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
    const { email, password } = await req.json();

    // Validation des champs
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe sont requis" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Chercher l'utilisateur par email
    const result = await pool.query(
      "SELECT id, email, password_hash, role, name FROM users WHERE email = $1",
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401, headers: corsHeaders }
      );
    }

    const user = result.rows[0];

    // Verifier le mot de passe avec bcrypt
    const passwordValid = await comparePassword(password, user.password_hash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Generer le token JWT
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    // Construire la reponse avec le token dans le body ET dans un cookie HttpOnly
    const response = NextResponse.json(
      {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
        },
      },
      { status: 200, headers: corsHeaders }
    );

    // Cookie HttpOnly pour le navigateur web (7 jours)
    response.cookies.set("joja_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 jours en secondes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Erreur login:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Erreur interne du serveur", detail: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
