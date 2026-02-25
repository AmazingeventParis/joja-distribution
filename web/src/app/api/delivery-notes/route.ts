// API Route : /api/delivery-notes
// GET : lister les BDL avec filtres (client_name, status, date, driver_id)
// POST : creer un nouveau BDL
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth-middleware";

// Headers CORS pour acces mobile
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET : lister les bons de livraison avec filtres optionnels
export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);

    const { searchParams } = new URL(req.url);
    const clientName = searchParams.get("client_name");
    const status = searchParams.get("status");
    const date = searchParams.get("date");
    const driverId = searchParams.get("driver_id");

    // Construction dynamique de la requete SQL
    let query = `
      SELECT
        dn.id, dn.bdl_number, dn.client_name, dn.client_email,
        dn.address, dn.details, dn.signature_path, dn.pdf_path,
        dn.status, dn.driver_id, dn.validated_at, dn.created_at,
        u.name AS driver_name
      FROM delivery_notes dn
      LEFT JOIN users u ON u.id = dn.driver_id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    let paramIndex = 1;

    // Si role=driver, ne montrer que ses propres BDL
    if (user.role === "driver") {
      query += ` AND dn.driver_id = $${paramIndex}`;
      params.push(user.userId);
      paramIndex++;
    }

    // Filtre par nom de client (recherche partielle, insensible a la casse)
    if (clientName) {
      query += ` AND dn.client_name ILIKE $${paramIndex}`;
      params.push(`%${clientName}%`);
      paramIndex++;
    }

    // Filtre par statut exact
    if (status) {
      query += ` AND dn.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Filtre par date (YYYY-MM-DD)
    if (date) {
      query += ` AND dn.created_at >= $${paramIndex}`;
      params.push(`${date}T00:00:00`);
      paramIndex++;
      query += ` AND dn.created_at <= $${paramIndex}`;
      params.push(`${date}T23:59:59`);
      paramIndex++;
    }

    // Filtre par chauffeur specifique (pour l'admin qui filtre)
    if (driverId && user.role === "admin") {
      query += ` AND dn.driver_id = $${paramIndex}`;
      params.push(driverId);
      paramIndex++;
    }

    query += " ORDER BY dn.created_at DESC";

    const result = await pool.query(query, params);

    return NextResponse.json(result.rows, { headers: corsHeaders });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders }
      );
    }
    console.error("Erreur GET /api/delivery-notes:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST : creer un nouveau bon de livraison
export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);

    const body = await req.json();
    const { client_name, client_email, address, details, signature_path } = body;

    // Validation
    if (!client_name || !client_name.trim()) {
      return NextResponse.json(
        { error: "Le nom du client est requis" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!address || !address.trim()) {
      return NextResponse.json(
        { error: "L'adresse de livraison est requise" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Generer le numero BDL : BDL-YYYYMMDD-XXXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");

    // Compter les BDL du jour pour le numero sequentiel
    const countResult = await pool.query(
      "SELECT COUNT(*) AS cnt FROM delivery_notes WHERE bdl_number LIKE $1",
      [`BDL-${dateStr}-%`]
    );
    const seq = parseInt(countResult.rows[0].cnt, 10) + 1;
    const bdlNumber = `BDL-${dateStr}-${String(seq).padStart(5, "0")}`;

    // Inserer le BDL
    const result = await pool.query(
      `INSERT INTO delivery_notes
        (id, bdl_number, client_name, client_email, address, details, signature_path, status, driver_id, validated_at, created_at)
       VALUES
        (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'VALIDATED', $7, NOW(), NOW())
       RETURNING *`,
      [
        bdlNumber,
        client_name.trim(),
        client_email?.trim() || null,
        address.trim(),
        details?.trim() || null,
        signature_path || null,
        user.userId,
      ]
    );

    return NextResponse.json(
      { ok: true, delivery_note: result.rows[0] },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders }
      );
    }
    console.error("Erreur POST /api/delivery-notes:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500, headers: corsHeaders }
    );
  }
}
