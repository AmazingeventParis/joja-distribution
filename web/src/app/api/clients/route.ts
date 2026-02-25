// API Route : gestion des clients (CRUD)
// Remplace les appels supabaseAdmin par des requetes PostgreSQL directes
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth-middleware";

// Headers CORS pour acces mobile
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET : lister tous les clients
export async function GET(req: NextRequest) {
  try {
    requireAuth(req);

    const result = await pool.query(
      "SELECT * FROM clients ORDER BY name ASC"
    );

    return NextResponse.json(result.rows, { headers: corsHeaders });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders }
      );
    }
    console.error("Erreur GET /api/clients:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST : creer un nouveau client
export async function POST(req: NextRequest) {
  try {
    requireAuth(req);

    const { name, email, address } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Le nom du client est requis" },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await pool.query(
      `INSERT INTO clients (id, name, email, address, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW())
       RETURNING *`,
      [name.trim(), email?.trim() || null, address?.trim() || null]
    );

    return NextResponse.json(
      { ok: true, client: result.rows[0] },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders }
      );
    }
    console.error("Erreur POST /api/clients:", error);
    return NextResponse.json(
      { error: "Erreur creation client : " + String(error) },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PUT : modifier un client
export async function PUT(req: NextRequest) {
  try {
    requireAuth(req);

    const { id, name, email, address } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID requis" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Le nom du client est requis" },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await pool.query(
      `UPDATE clients SET name = $1, email = $2, address = $3
       WHERE id = $4
       RETURNING *`,
      [name.trim(), email?.trim() || null, address?.trim() || null, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Client introuvable" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { ok: true, client: result.rows[0] },
      { headers: corsHeaders }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders }
      );
    }
    console.error("Erreur PUT /api/clients:", error);
    return NextResponse.json(
      { error: "Erreur modification client : " + String(error) },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE : supprimer un client
export async function DELETE(req: NextRequest) {
  try {
    requireAuth(req);

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID requis" },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await pool.query(
      "DELETE FROM clients WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Client introuvable" },
        { status: 404, headers: corsHeaders }
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
    console.error("Erreur DELETE /api/clients:", error);
    return NextResponse.json(
      { error: "Erreur suppression client : " + String(error) },
      { status: 500, headers: corsHeaders }
    );
  }
}
