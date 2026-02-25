// API Route : POST /api/auth/logout
// Supprime le cookie joja_token pour deconnecter l'utilisateur web
import { NextResponse } from "next/server";

// Headers CORS pour acces mobile
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST() {
  const response = NextResponse.json(
    { ok: true },
    { headers: corsHeaders }
  );

  // Supprimer le cookie en le mettant a une date dans le passe
  response.cookies.set("joja_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
