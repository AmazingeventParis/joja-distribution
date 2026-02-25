// API Route : gestion des chauffeurs (CRUD)
// Remplace les appels Supabase Auth + profiles par PostgreSQL + bcrypt
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireAuth, requireAdmin, AuthError } from "@/lib/auth-middleware";

// Headers CORS pour acces mobile
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET : lister tous les chauffeurs
export async function GET(req: NextRequest) {
  try {
    requireAuth(req);

    const result = await pool.query(
      `SELECT id, name, email, created_at
       FROM users
       WHERE role = 'driver'
       ORDER BY created_at DESC`
    );

    return NextResponse.json(result.rows, { headers: corsHeaders });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders }
      );
    }
    console.error("Erreur GET /api/drivers:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST : creer un nouveau chauffeur
export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);

    const { name, email, password } = await req.json();

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nom, email et mot de passe sont requis" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caracteres" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verifier que l'email n'existe pas deja
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.trim().toLowerCase()]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Un utilisateur avec cet email existe deja" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Hasher le mot de passe
    const passwordHash = await hashPassword(password);

    // Inserer le chauffeur
    const result = await pool.query(
      `INSERT INTO users (id, email, password_hash, role, name, created_at)
       VALUES (gen_random_uuid(), $1, $2, 'driver', $3, NOW())
       RETURNING id, email, name, created_at`,
      [email.trim().toLowerCase(), passwordHash, name.trim()]
    );

    const driver = result.rows[0];

    return NextResponse.json(
      { ok: true, driver },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders }
      );
    }
    console.error("Erreur POST /api/drivers:", error);
    return NextResponse.json(
      { error: "Erreur creation chauffeur : " + String(error) },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PUT : modifier un chauffeur (nom, email, mot de passe optionnel)
export async function PUT(req: NextRequest) {
  try {
    requireAdmin(req);

    const { id, name, email, password } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID requis" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Mettre a jour le nom et l'email
    if (name || email) {
      const updates: string[] = [];
      const values: string[] = [];
      let paramIndex = 1;

      if (name) {
        updates.push(`name = $${paramIndex}`);
        values.push(name.trim());
        paramIndex++;
      }

      if (email) {
        // Verifier que le nouvel email n'est pas pris par un autre utilisateur
        const existing = await pool.query(
          "SELECT id FROM users WHERE email = $1 AND id != $2",
          [email.trim().toLowerCase(), id]
        );
        if (existing.rows.length > 0) {
          return NextResponse.json(
            { error: "Cet email est deja utilise par un autre utilisateur" },
            { status: 400, headers: corsHeaders }
          );
        }

        updates.push(`email = $${paramIndex}`);
        values.push(email.trim().toLowerCase());
        paramIndex++;
      }

      if (updates.length > 0) {
        values.push(id);
        await pool.query(
          `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
          values
        );
      }
    }

    // Mettre a jour le mot de passe si fourni
    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "Le mot de passe doit contenir au moins 6 caracteres" },
          { status: 400, headers: corsHeaders }
        );
      }

      const passwordHash = await hashPassword(password);
      await pool.query(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        [passwordHash, id]
      );
    }

    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders }
      );
    }
    console.error("Erreur PUT /api/drivers:", error);
    return NextResponse.json(
      { error: "Erreur modification chauffeur : " + String(error) },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE : supprimer un chauffeur
export async function DELETE(req: NextRequest) {
  try {
    requireAdmin(req);

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID requis" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verifier que l'utilisateur existe et est bien un driver
    const check = await pool.query(
      "SELECT id, role FROM users WHERE id = $1",
      [id]
    );

    if (check.rows.length === 0) {
      return NextResponse.json(
        { error: "Chauffeur introuvable" },
        { status: 404, headers: corsHeaders }
      );
    }

    if (check.rows[0].role !== "driver") {
      return NextResponse.json(
        { error: "Impossible de supprimer un utilisateur qui n'est pas chauffeur" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Supprimer le chauffeur
    await pool.query("DELETE FROM users WHERE id = $1", [id]);

    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders }
      );
    }
    console.error("Erreur DELETE /api/drivers:", error);
    return NextResponse.json(
      { error: "Erreur suppression chauffeur : " + String(error) },
      { status: 500, headers: corsHeaders }
    );
  }
}
