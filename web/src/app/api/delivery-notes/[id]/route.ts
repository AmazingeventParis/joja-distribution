// API Route : /api/delivery-notes/[id]
// GET : detail d'un BDL avec le nom du chauffeur
// PATCH : mettre a jour un BDL (statut, pdf_path, etc.)
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth-middleware";

// Headers CORS pour acces mobile
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET : recuperer le detail d'un BDL
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = requireAuth(req);
    const { id } = params;

    const result = await pool.query(
      `SELECT
        dn.id, dn.bdl_number, dn.client_name, dn.client_email,
        dn.address, dn.details, dn.signature_path, dn.pdf_path,
        dn.status, dn.driver_id, dn.validated_at, dn.created_at,
        u.name AS driver_name
       FROM delivery_notes dn
       LEFT JOIN users u ON u.id = dn.driver_id
       WHERE dn.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "BDL introuvable" },
        { status: 404, headers: corsHeaders }
      );
    }

    const bdl = result.rows[0];

    // Verifier que le driver ne voit que ses propres BDL
    if (user.role === "driver" && bdl.driver_id !== user.userId) {
      return NextResponse.json(
        { error: "Acces non autorise" },
        { status: 403, headers: corsHeaders }
      );
    }

    return NextResponse.json(bdl, { headers: corsHeaders });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders }
      );
    }
    console.error("Erreur GET /api/delivery-notes/[id]:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PATCH : mettre a jour un BDL
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = requireAuth(req);
    const { id } = params;

    const body = await req.json();
    const allowedFields = [
      "client_name",
      "client_email",
      "address",
      "details",
      "signature_path",
      "pdf_path",
      "status",
    ];

    // Construire dynamiquement le SET pour les champs fournis
    const updates: string[] = [];
    const values: (string | null)[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Seuls les admins peuvent changer le statut
        if (field === "status" && user.role !== "admin") {
          return NextResponse.json(
            { error: "Seuls les administrateurs peuvent modifier le statut" },
            { status: 403, headers: corsHeaders }
          );
        }
        updates.push(`${field} = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "Aucun champ a mettre a jour" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Ajouter l'ID en dernier parametre
    values.push(id);

    const result = await pool.query(
      `UPDATE delivery_notes SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "BDL introuvable" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { ok: true, delivery_note: result.rows[0] },
      { headers: corsHeaders }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders }
      );
    }
    console.error("Erreur PATCH /api/delivery-notes/[id]:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500, headers: corsHeaders }
    );
  }
}
