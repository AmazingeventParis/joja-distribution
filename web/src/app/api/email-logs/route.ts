// API Route : GET /api/email-logs
// Liste les logs d'emails pour un BDL donne
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth-middleware";

// Headers CORS pour acces mobile
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    requireAuth(req);

    const { searchParams } = new URL(req.url);
    const deliveryNoteId = searchParams.get("delivery_note_id");

    if (!deliveryNoteId) {
      return NextResponse.json(
        { error: "delivery_note_id est requis" },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await pool.query(
      `SELECT id, delivery_note_id, to_email, status, error, created_at
       FROM email_logs
       WHERE delivery_note_id = $1
       ORDER BY created_at DESC`,
      [deliveryNoteId]
    );

    return NextResponse.json(result.rows, { headers: corsHeaders });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders }
      );
    }
    console.error("Erreur GET /api/email-logs:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500, headers: corsHeaders }
    );
  }
}
