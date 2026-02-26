// API Route : GET /api/files/{bucket}/{filename}
// Sert les fichiers depuis PostgreSQL (table files, colonne bytea)
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-middleware";
import { pool } from "@/lib/db";
import pathModule from "path";

// Buckets autorises
const ALLOWED_BUCKETS = ["logos", "signatures", "pdfs"];

// Headers CORS pour acces mobile
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifie" },
        { status: 401, headers: corsHeaders }
      );
    }

    const pathSegments = params.path;

    if (!pathSegments || pathSegments.length < 2) {
      return NextResponse.json(
        { error: "Chemin invalide. Format attendu : /api/files/{bucket}/{filename}" },
        { status: 400, headers: corsHeaders }
      );
    }

    const bucket = pathSegments[0];
    const filename = pathSegments.slice(1).join("/");

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json(
        { error: "Bucket non autorise" },
        { status: 400, headers: corsHeaders }
      );
    }

    const safeName = pathModule.basename(filename);
    if (safeName !== filename || filename.includes("..")) {
      return NextResponse.json(
        { error: "Nom de fichier invalide" },
        { status: 400, headers: corsHeaders }
      );
    }

    const { rows } = await pool.query(
      "SELECT data, mime_type FROM files WHERE bucket = $1 AND filename = $2",
      [bucket, safeName]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Fichier introuvable" },
        { status: 404, headers: corsHeaders }
      );
    }

    const fileData = rows[0].data as Buffer;
    const mimeType = rows[0].mime_type as string;

    return new NextResponse(new Uint8Array(fileData), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/files/[...path]:", error);
    return NextResponse.json(
      { error: "Erreur lors de la lecture du fichier" },
      { status: 500, headers: corsHeaders }
    );
  }
}
