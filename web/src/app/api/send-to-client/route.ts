// API Route : Envoyer le PDF du BDL au client par email
// POST /api/send-to-client { delivery_note_id }

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { delivery_note_id } = await req.json();

    if (!delivery_note_id) {
      return NextResponse.json(
        { ok: false, error: "delivery_note_id est requis" },
        { status: 400 }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        { ok: false, error: "RESEND_API_KEY non configurée" },
        { status: 500 }
      );
    }

    // 1) Charger le BDL
    const { data: bdl, error: bdlError } = await supabaseAdmin
      .from("delivery_notes")
      .select("*")
      .eq("id", delivery_note_id)
      .single();

    if (bdlError || !bdl) {
      return NextResponse.json(
        { ok: false, error: "BDL introuvable" },
        { status: 404 }
      );
    }

    // Vérifier que le client a un email
    if (!bdl.client_email) {
      return NextResponse.json(
        { ok: false, error: "Aucun email client renseigné pour ce BDL" },
        { status: 400 }
      );
    }

    // Vérifier que le PDF existe
    if (!bdl.pdf_path) {
      return NextResponse.json(
        { ok: false, error: "Aucun PDF disponible pour ce BDL" },
        { status: 400 }
      );
    }

    // 2) Charger les infos société
    const { data: company } = await supabaseAdmin
      .from("company_settings")
      .select("*")
      .single();

    const companyName = company?.company_name || "JOJA DISTRIBUTION";

    // 3) Charger le nom du livreur
    const { data: driver } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", bdl.driver_id)
      .single();

    const driverName = driver?.name || "Livreur inconnu";

    // 4) Télécharger le PDF depuis Supabase Storage
    const { data: pdfData, error: pdfError } = await supabaseAdmin.storage
      .from("pdfs")
      .download(bdl.pdf_path);

    if (pdfError || !pdfData) {
      return NextResponse.json(
        { ok: false, error: "Impossible de télécharger le PDF" },
        { status: 500 }
      );
    }

    // Convertir le PDF en base64
    const pdfArrayBuffer = await pdfData.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    // 5) Formater la date
    const validatedDate = new Date(bdl.validated_at).toLocaleString("fr-FR", {
      dateStyle: "long",
      timeStyle: "short",
    });

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

    // 7) Logger le résultat dans email_logs
    await supabaseAdmin.from("email_logs").insert({
      delivery_note_id: delivery_note_id,
      to_email: bdl.client_email,
      status: emailResponse.ok ? "sent" : "failed",
      error: emailResponse.ok ? null : JSON.stringify(emailResult),
    });

    if (!emailResponse.ok) {
      return NextResponse.json(
        { ok: false, error: "Erreur envoi email : " + JSON.stringify(emailResult) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Email envoyé à ${bdl.client_email}`,
    });
  } catch (error) {
    console.error("Erreur send-to-client:", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
