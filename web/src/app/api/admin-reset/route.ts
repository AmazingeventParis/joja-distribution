// Route temporaire pour re-hasher les mots de passe avec bcryptjs v3
// A SUPPRIMER apres utilisation
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password, secret } = await req.json();

    // Protection basique
    if (secret !== "joja-reset-2026") {
      return NextResponse.json({ error: "Secret invalide" }, { status: 403 });
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Email et password requis" }, { status: 400 });
    }

    // Generer le nouveau hash avec bcryptjs v3
    const newHash = await hashPassword(password);

    // Mettre a jour en base
    const result = await pool.query(
      "UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, email, name, role",
      [newHash, email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, user: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
