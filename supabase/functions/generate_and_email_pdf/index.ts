// ============================================================
// EDGE FUNCTION : generate_and_email_pdf
// Génère un vrai PDF avec pdf-lib et l'envoie par email
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

// --- Headers CORS ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- Retour à la ligne automatique ---
function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSize: number,
  maxWidth: number
): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(" ");
    let currentLine = "";
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  }
  return lines;
}

// --- Nettoyer le texte pour les polices standard (WinAnsi) ---
function cleanText(text: string): string {
  return text
    .replace(/\u2014/g, "-")   // em dash
    .replace(/\u2013/g, "-")   // en dash
    .replace(/\u2018/g, "'")   // left single quote
    .replace(/\u2019/g, "'")   // right single quote
    .replace(/\u201C/g, '"')   // left double quote
    .replace(/\u201D/g, '"')   // right double quote
    .replace(/\u2026/g, "..."); // ellipsis
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- 1) Lire le body ---
    const { delivery_note_id } = await req.json();

    if (!delivery_note_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "delivery_note_id est requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- 2) Client Supabase ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- 3) Charger le BDL ---
    const { data: bdl, error: bdlError } = await supabase
      .from("delivery_notes")
      .select("*")
      .eq("id", delivery_note_id)
      .single();

    if (bdlError || !bdl) {
      return new Response(
        JSON.stringify({ ok: false, error: "BDL introuvable : " + bdlError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- 4) Charger les paramètres société ---
    const { data: company } = await supabase
      .from("company_settings")
      .select("*")
      .single();

    const companyName = company?.company_name || "JOJA DISTRIBUTION";
    const mainEmail = company?.main_email || "joy.slama@gmail.com";

    // --- 5) Charger le profil du livreur ---
    const { data: driver } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", bdl.driver_id)
      .single();

    const driverName = driver?.name || "Livreur inconnu";

    // --- 6) Récupérer la signature (bytes bruts) ---
    let signatureBytes: Uint8Array | null = null;
    if (bdl.signature_path) {
      const { data: sigData } = await supabase.storage
        .from("signatures")
        .download(bdl.signature_path);
      if (sigData) {
        signatureBytes = new Uint8Array(await sigData.arrayBuffer());
      }
    }

    // --- 7) Récupérer le logo (bytes bruts) ---
    let logoBytes: Uint8Array | null = null;
    if (company?.logo_path) {
      const { data: logoData } = await supabase.storage
        .from("logos")
        .download(company.logo_path);
      if (logoData) {
        logoBytes = new Uint8Array(await logoData.arrayBuffer());
      }
    }

    // --- 8) Formater la date ---
    const dateObj = new Date(bdl.validated_at);
    const moisFR = [
      "janvier", "fevrier", "mars", "avril", "mai", "juin",
      "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
    ];
    const jour = dateObj.getDate();
    const mois = moisFR[dateObj.getMonth()];
    const annee = dateObj.getFullYear();
    const heures = String(dateObj.getHours()).padStart(2, "0");
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");
    const validatedDate = `${jour} ${mois} ${annee} a ${heures}:${minutes}`;

    // ==========================================================
    // --- 9) GÉNÉRER LE PDF AVEC pdf-lib ---
    // ==========================================================
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4

    // Polices
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    // Couleurs
    const blue = rgb(0.12, 0.25, 0.68);
    const blueAccent = rgb(0.15, 0.39, 0.92);
    const darkText = rgb(0.2, 0.2, 0.2);
    const grayText = rgb(0.42, 0.45, 0.50);
    const bgGray = rgb(0.97, 0.98, 0.99);
    const bgBlue = rgb(0.94, 0.96, 1.0);
    const borderBlue = rgb(0.75, 0.86, 0.99);

    const marginLeft = 40;
    const pageWidth = 595.28;
    const contentWidth = pageWidth - marginLeft * 2;
    let y = 800;

    // --- EN-TÊTE : Logo + Nom société ---
    let logoXEnd = marginLeft;
    if (logoBytes) {
      try {
        let logoImage;
        try {
          logoImage = await pdfDoc.embedPng(logoBytes);
        } catch {
          logoImage = await pdfDoc.embedJpg(logoBytes);
        }
        const logoScale = 50 / logoImage.height;
        const logoW = logoImage.width * logoScale;
        page.drawImage(logoImage, {
          x: marginLeft,
          y: y - 40,
          width: logoW,
          height: 50,
        });
        logoXEnd = marginLeft + logoW + 12;
      } catch {
        // Logo invalide, on continue sans
      }
    }

    page.drawText(cleanText(companyName), {
      x: logoXEnd,
      y: y - 8,
      size: 20,
      font: helveticaBold,
      color: blue,
    });

    // Numéro BDL (à droite)
    const bdlNumText = cleanText(bdl.bdl_number);
    const bdlNumW = helveticaBold.widthOfTextAtSize(bdlNumText, 13);
    page.drawText(bdlNumText, {
      x: pageWidth - marginLeft - bdlNumW,
      y: y - 5,
      size: 13,
      font: helveticaBold,
      color: grayText,
    });

    // Date (à droite)
    const dateText = cleanText(validatedDate);
    const dateW = helvetica.widthOfTextAtSize(dateText, 10);
    page.drawText(dateText, {
      x: pageWidth - marginLeft - dateW,
      y: y - 22,
      size: 10,
      font: helvetica,
      color: grayText,
    });

    y -= 55;

    // Ligne bleue
    page.drawLine({
      start: { x: marginLeft, y },
      end: { x: pageWidth - marginLeft, y },
      thickness: 2.5,
      color: blueAccent,
    });

    y -= 35;

    // --- TITRE ---
    const title = "BON DE LIVRAISON";
    const titleW = helveticaBold.widthOfTextAtSize(title, 18);
    page.drawText(title, {
      x: (pageWidth - titleW) / 2,
      y,
      size: 18,
      font: helveticaBold,
      color: blue,
    });

    y -= 40;

    // --- Fonction locale : dessiner une section ---
    const drawSection = (
      sx: number,
      sy: number,
      sw: number,
      sTitle: string,
      sContent: string,
      bgColor = bgGray,
    ): number => {
      const text = cleanText(sContent || "Non renseigne");
      const lines = wrapText(text, helvetica, 11, sw - 24);
      const boxH = 22 + lines.length * 16 + 8;

      // Fond
      page.drawRectangle({
        x: sx,
        y: sy - boxH,
        width: sw,
        height: boxH,
        color: bgColor,
      });

      // Barre bleue à gauche
      page.drawRectangle({
        x: sx,
        y: sy - boxH,
        width: 3,
        height: boxH,
        color: blueAccent,
      });

      // Titre
      page.drawText(cleanText(sTitle), {
        x: sx + 12,
        y: sy - 16,
        size: 9,
        font: helveticaBold,
        color: blue,
      });

      // Contenu
      let lineY = sy - 34;
      for (const line of lines) {
        page.drawText(line, {
          x: sx + 12,
          y: lineY,
          size: 11,
          font: helvetica,
          color: darkText,
        });
        lineY -= 16;
      }

      return sy - boxH - 12;
    };

    // --- SECTIONS ---
    const halfW = (contentWidth - 15) / 2;

    // Client + Email (côte à côte)
    const y1 = drawSection(marginLeft, y, halfW, "CLIENT / SOCIETE", bdl.client_name);
    const y2 = drawSection(
      marginLeft + halfW + 15,
      y,
      halfW,
      "EMAIL CLIENT",
      bdl.client_email || "Non renseigne"
    );
    y = Math.min(y1, y2);

    // Adresse
    y = drawSection(marginLeft, y, contentWidth, "ADRESSE DE LIVRAISON", bdl.address);

    // Détails (fond bleu clair avec bordure)
    const detailText = cleanText(bdl.details || "Aucun detail");
    const detailLines = wrapText(detailText, helvetica, 11, contentWidth - 24);
    const detailBoxH = 22 + detailLines.length * 16 + 8;

    page.drawRectangle({
      x: marginLeft,
      y: y - detailBoxH,
      width: contentWidth,
      height: detailBoxH,
      color: bgBlue,
      borderColor: borderBlue,
      borderWidth: 1,
    });

    page.drawText("DETAILS DE LA LIVRAISON", {
      x: marginLeft + 12,
      y: y - 16,
      size: 9,
      font: helveticaBold,
      color: blue,
    });

    let detailY = y - 34;
    for (const line of detailLines) {
      page.drawText(line, {
        x: marginLeft + 12,
        y: detailY,
        size: 11,
        font: helvetica,
        color: darkText,
      });
      detailY -= 16;
    }

    y = y - detailBoxH - 12;

    // Livreur
    y = drawSection(marginLeft, y, contentWidth, "LIVREUR", driverName);

    // --- SIGNATURE ---
    y -= 5;
    const sigTitle = "SIGNATURE DU CLIENT";
    const sigTitleW = helveticaBold.widthOfTextAtSize(sigTitle, 9);
    page.drawText(sigTitle, {
      x: (pageWidth - sigTitleW) / 2,
      y,
      size: 9,
      font: helveticaBold,
      color: blue,
    });
    y -= 15;

    if (signatureBytes) {
      try {
        let sigImage;
        try {
          sigImage = await pdfDoc.embedPng(signatureBytes);
        } catch {
          sigImage = await pdfDoc.embedJpg(signatureBytes);
        }

        const maxSigW = 250;
        const maxSigH = 120;
        const sigScale = Math.min(maxSigW / sigImage.width, maxSigH / sigImage.height);
        const sigW = sigImage.width * sigScale;
        const sigH = sigImage.height * sigScale;

        // Cadre blanc avec bordure
        page.drawRectangle({
          x: (pageWidth - sigW - 8) / 2,
          y: y - sigH - 4,
          width: sigW + 8,
          height: sigH + 8,
          borderColor: rgb(0.9, 0.91, 0.92),
          borderWidth: 1,
          color: rgb(1, 1, 1),
        });

        page.drawImage(sigImage, {
          x: (pageWidth - sigW) / 2,
          y: y - sigH,
          width: sigW,
          height: sigH,
        });

        y -= sigH + 18;
      } catch {
        const noSigText = "Signature non disponible";
        const noSigW = helvetica.widthOfTextAtSize(noSigText, 11);
        page.drawText(noSigText, {
          x: (pageWidth - noSigW) / 2,
          y,
          size: 11,
          font: helvetica,
          color: grayText,
        });
        y -= 20;
      }
    } else {
      const noSigText = "Aucune signature";
      const noSigW = helvetica.widthOfTextAtSize(noSigText, 11);
      page.drawText(noSigText, {
        x: (pageWidth - noSigW) / 2,
        y,
        size: 11,
        font: helvetica,
        color: grayText,
      });
      y -= 20;
    }

    // "Lu et approuve"
    const luText = "Lu et approuve";
    const luW = helveticaOblique.widthOfTextAtSize(luText, 10);
    page.drawText(luText, {
      x: (pageWidth - luW) / 2,
      y: y - 3,
      size: 10,
      font: helveticaOblique,
      color: grayText,
    });

    // --- PIED DE PAGE ---
    page.drawLine({
      start: { x: marginLeft, y: 55 },
      end: { x: pageWidth - marginLeft, y: 55 },
      thickness: 0.5,
      color: rgb(0.9, 0.91, 0.92),
    });

    const footerText = cleanText(
      `${companyName} - Document genere automatiquement le ${validatedDate}`
    );
    const footerW = helvetica.widthOfTextAtSize(footerText, 9);
    page.drawText(footerText, {
      x: (pageWidth - footerW) / 2,
      y: 40,
      size: 9,
      font: helvetica,
      color: grayText,
    });

    // --- Sauvegarder le PDF ---
    const pdfBytes = await pdfDoc.save();

    // --- 10) Uploader le PDF dans Supabase Storage ---
    const pdfPath = `${bdl.bdl_number}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("pdfs")
      .upload(pdfPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Erreur upload PDF:", uploadError);
    }

    // --- 11) Mettre à jour le BDL avec le chemin du PDF ---
    await supabase
      .from("delivery_notes")
      .update({ pdf_path: pdfPath })
      .eq("id", delivery_note_id);

    // --- 12) Préparer les destinataires ---
    const recipients: string[] = [mainEmail];
    if (bdl.client_email) {
      recipients.push(bdl.client_email);
    }

    // --- 13) Encoder le PDF en base64 pour l'email ---
    let pdfBase64 = "";
    {
      let binary = "";
      for (let i = 0; i < pdfBytes.length; i++) {
        binary += String.fromCharCode(pdfBytes[i]);
      }
      pdfBase64 = btoa(binary);
    }

    // --- 14) Envoyer les emails via Resend ---
    let allEmailsSent = true;

    for (const toEmail of recipients) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "JOJA DISTRIBUTION <onboarding@resend.dev>",
            to: [toEmail],
            subject: `Bon de Livraison ${bdl.bdl_number} - ${companyName}`,
            html: `
              <h2>Bon de Livraison ${bdl.bdl_number}</h2>
              <p>Bonjour,</p>
              <p>Veuillez trouver ci-joint le bon de livraison <strong>${bdl.bdl_number}</strong>.</p>
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

        await supabase.from("email_logs").insert({
          delivery_note_id: delivery_note_id,
          to_email: toEmail,
          status: emailResponse.ok ? "sent" : "failed",
          error: emailResponse.ok ? null : JSON.stringify(emailResult),
        });

        if (!emailResponse.ok) {
          allEmailsSent = false;
          console.error(`Email echoue pour ${toEmail}:`, emailResult);
        }
      } catch (emailError) {
        allEmailsSent = false;
        await supabase.from("email_logs").insert({
          delivery_note_id: delivery_note_id,
          to_email: toEmail,
          status: "failed",
          error: String(emailError),
        });
        console.error(`Erreur envoi email a ${toEmail}:`, emailError);
      }
    }

    // --- 15) Mettre à jour le statut du BDL ---
    const newStatus = allEmailsSent ? "EMAIL_SENT" : "EMAIL_FAILED";
    await supabase
      .from("delivery_notes")
      .update({ status: newStatus })
      .eq("id", delivery_note_id);

    // --- 16) Retourner le résultat ---
    return new Response(
      JSON.stringify({
        ok: true,
        pdf_path: pdfPath,
        bdl_number: bdl.bdl_number,
        email_status: newStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erreur globale:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
