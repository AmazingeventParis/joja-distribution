// API Route : POST /api/files/upload
// Upload de fichiers (logos, signatures, pdfs) vers le systeme de fichiers local
// Remplace Supabase Storage
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth-middleware";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// Repertoire d'uploads (configurable via env, defaut /app/uploads en production)
const UPLOADS_DIR = process.env.UPLOADS_DIR || "/app/uploads";

// Buckets autorises
const ALLOWED_BUCKETS = ["logos", "signatures", "pdfs"];

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
    requireAuth(req);

    // Parser le multipart form data
    const formData = await req.formData();
    const bucket = formData.get("bucket") as string;
    const file = formData.get("file") as File;

    // Validation du bucket
    if (!bucket || !ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json(
        { error: `Bucket invalide. Buckets autorises : ${ALLOWED_BUCKETS.join(", ")}` },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validation du fichier
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Fichier manquant dans le formulaire" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Generer un nom de fichier unique
    const ext = path.extname(file.name) || getExtensionFromType(file.type);
    const filename = `${randomUUID()}${ext}`;

    // Creer le repertoire du bucket si necessaire
    const bucketDir = path.join(UPLOADS_DIR, bucket);
    await mkdir(bucketDir, { recursive: true });

    // Ecrire le fichier sur disque
    const filePath = path.join(bucketDir, filename);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, buffer);

    return NextResponse.json(
      { path: filename },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders }
      );
    }
    console.error("Erreur POST /api/files/upload:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload du fichier" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Deviner l'extension a partir du type MIME
function getExtensionFromType(mimeType: string): string {
  const map: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "image/svg+xml": ".svg",
  };
  return map[mimeType] || ".bin";
}
