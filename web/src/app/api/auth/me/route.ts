// API Route : GET /api/auth/me
// Retourne les informations de l'utilisateur connecte a partir du token JWT
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-middleware";

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
    const user = getUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { error: "Non authentifie" },
        { status: 401, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        user: {
          id: user.userId,
          email: user.email,
          role: user.role,
          name: user.name,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Erreur /api/auth/me:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500, headers: corsHeaders }
    );
  }
}
