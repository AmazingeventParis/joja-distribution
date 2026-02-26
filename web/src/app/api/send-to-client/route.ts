// API Route : POST /api/send-to-client
// Envoyer le PDF du BDL au client par email via Resend
// Lit le PDF depuis PostgreSQL (table files)
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth-middleware";

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

    const { delivery_note_id } = await req.json();

    if (!delivery_note_id) {
      return NextResponse.json(
        { ok: false, error: "delivery_note_id est requis" },
        { status: 400, headers: corsHeaders }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        { ok: false, error: "RESEND_API_KEY non configuree" },
        { status: 500, headers: corsHeaders }
      );
    }

    // 1) Charger le BDL
    const { rows: bdlRows } = await pool.query(
      "SELECT * FROM delivery_notes WHERE id = $1",
      [delivery_note_id]
    );

    if (bdlRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "BDL introuvable" },
        { status: 404, headers: corsHeaders }
      );
    }

    const bdl = bdlRows[0];

    // Verifier que le client a un email
    if (!bdl.client_email) {
      return NextResponse.json(
        { ok: false, error: "Aucun email client renseigne pour ce BDL" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verifier que le PDF existe
    if (!bdl.pdf_path) {
      return NextResponse.json(
        { ok: false, error: "Aucun PDF disponible pour ce BDL" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2) Charger les infos societe
    const { rows: companyRows } = await pool.query(
      "SELECT * FROM company_settings LIMIT 1"
    );
    const companyName = companyRows[0]?.company_name || "JOJA DISTRIBUTION";

    // 3) Charger le nom du livreur
    const { rows: driverRows } = await pool.query(
      "SELECT name FROM users WHERE id = $1",
      [bdl.driver_id]
    );
    const driverName = driverRows[0]?.name || "Livreur inconnu";

    // 4) Lire le PDF depuis PostgreSQL
    const { rows: fileRows } = await pool.query(
      "SELECT data FROM files WHERE bucket = 'pdfs' AND filename = $1",
      [bdl.pdf_path]
    );

    if (fileRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Impossible de lire le fichier PDF" },
        { status: 500, headers: corsHeaders }
      );
    }

    // Convertir le PDF en base64
    const pdfBase64 = (fileRows[0].data as Buffer).toString("base64");

    // 5) Formater la date
    const dateObj = new Date(bdl.validated_at);
    const moisFR = [
      "janvier", "fevrier", "mars", "avril", "mai", "juin",
      "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
    ];
    const validatedDate = `${dateObj.getDate()} ${moisFR[dateObj.getMonth()]} ${dateObj.getFullYear()} a ${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;

    // 6) Envoyer l'email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${companyName} <noreply@swipego.app>`,
        to: [bdl.client_email],
        subject: `Votre Bon de Livraison ${bdl.bdl_number} - ${companyName}`,
        html: `
          <h2>Bon de Livraison ${bdl.bdl_number}</h2>
          <p>Bonjour,</p>
          <p>Veuillez trouver ci-joint votre bon de livraison <strong>${bdl.bdl_number}</strong>.</p>
          <ul>
            <li><strong>Client :</strong> ${bdl.client_name}</li>
            <li><strong>Adresse :</strong> ${bdl.address}</li>
            <li><strong>Date :</strong> ${validatedDate}</li>
            <li><strong>Livreur :</strong> ${driverName}</li>
          </ul>
          <p>Cordialement,<br>${companyName}</p>
        `,
        attachments: [
          {
            filename: `${bdl.bdl_number}.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    });

    const emailResult = await emailResponse.json();

    // 7) Logger le resultat dans email_logs
    await pool.query(
      `INSERT INTO email_logs (id, delivery_note_id, to_email, status, error, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
      [
        delivery_note_id,
        bdl.client_email,
        emailResponse.ok ? "sent" : "failed",
        emailResponse.ok ? null : JSON.stringify(emailResult),
      ]
    );

    if (!emailResponse.ok) {
      return NextResponse.json(
        { ok: false, error: "Erreur envoi email : " + JSON.stringify(emailResult) },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { ok: true, message: `Email envoye a ${bdl.client_email}` },
      { headers: corsHeaders }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status, headers: corsHeaders }
      );
    }
    console.error("Erreur send-to-client:", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500, headers: corsHeaders }
    );
  }
}
