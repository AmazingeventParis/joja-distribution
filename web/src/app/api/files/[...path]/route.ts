// API Route : GET /api/files/{bucket}/{filename}
// Sert les fichiers depuis le systeme de fichiers local (remplace Supabase Storage signed URLs)
// Catch-all route : /api/files/pdfs/BDL-xxx.pdf, /api/files/signatures/xxx.png, etc.
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-middleware";
import { readFile, stat } from "fs/promises";
import pathModule from "path";

// Repertoire d'uploads
const UPLOADS_DIR = process.env.UPLOADS_DIR || "/app/uploads";

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
    // Verifier l'authentification (Bearer header ou cookie)
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifie" },
        { status: 401, headers: corsHeaders }
      );
    }

    const pathSegments = params.path;

    // On attend au minimum : bucket/filename
    if (!pathSegments || pathSegments.length < 2) {
      return NextResponse.json(
        { error: "Chemin invalide. Format attendu : /api/files/{bucket}/{filename}" },
        { status: 400, headers: corsHeaders }
      );
    }

    const bucket = pathSegments[0];
    const filename = pathSegments.slice(1).join("/");

    // Verifier le bucket
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json(
        { error: "Bucket non autorise" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Securite : empecher les path traversal (../../etc/passwd)
    const safeName = pathModule.basename(filename);
    if (safeName !== filename || filename.includes("..")) {
      return NextResponse.json(
        { error: "Nom de fichier invalide" },
        { status: 400, headers: corsHeaders }
      );
    }

    const filePath = pathModule.join(UPLOADS_DIR, bucket, safeName);

    // Verifier que le fichier existe
    try {
      await stat(filePath);
    } catch {
      return NextResponse.json(
        { error: "Fichier introuvable" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Lire le fichier
    const fileBuffer = await readFile(filePath);

    // Determiner le Content-Type
    const contentType = getContentType(safeName);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
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

// Determiner le type MIME a partir de l'extension
function getContentType(filename: string): string {
  const ext = pathModule.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".gif": "image/gif",
  };
  return mimeTypes[ext] || "application/octet-stream";
}
