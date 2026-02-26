// API Route : POST /api/files/upload
// Upload de fichiers (logos, signatures, pdfs) dans PostgreSQL (table files, colonne bytea)
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth-middleware";
import { pool } from "@/lib/db";
import path from "path";
import { randomUUID } from "crypto";

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

    const formData = await req.formData();
    const bucket = formData.get("bucket") as string;
    const file = formData.get("file") as File;

    if (!bucket || !ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json(
        { error: `Bucket invalide. Buckets autorises : ${ALLOWED_BUCKETS.join(", ")}` },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Fichier manquant dans le formulaire" },
        { status: 400, headers: corsHeaders }
      );
    }

    const ext = path.extname(file.name) || getExtensionFromType(file.type);
    const filename = `${randomUUID()}${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await pool.query(
      `INSERT INTO files (id, bucket, filename, data, mime_type, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
      [bucket, filename, buffer, file.type || getMimeFromExt(ext)]
    );

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

function getMimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".svg": "image/svg+xml",
  };
  return map[ext] || "application/octet-stream";
}
