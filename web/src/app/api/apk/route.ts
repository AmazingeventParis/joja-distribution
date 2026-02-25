// API Route : GET /api/apk
// Telecharger l'APK mobile JOJA Distribution (acces public, pas d'auth)
import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import pathModule from "path";

const UPLOADS_DIR = process.env.UPLOADS_DIR || "/app/uploads";
const APK_FILENAME = "joja-distribution.apk";

export async function GET() {
  try {
    const apkPath = pathModule.join(UPLOADS_DIR, "apk", APK_FILENAME);

    // Verifier que le fichier existe
    try {
      await stat(apkPath);
    } catch {
      return NextResponse.json(
        { error: "APK non disponible" },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(apkPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": `attachment; filename="${APK_FILENAME}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/apk:", error);
    return NextResponse.json(
      { error: "Erreur lors du telechargement de l'APK" },
      { status: 500 }
    );
  }
}
