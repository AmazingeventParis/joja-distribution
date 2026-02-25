"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

// Types
interface DeliveryNote {
  id: string;
  bdl_number: string;
  client_name: string;
  client_email: string | null;
  address: string;
  details: string;
  signature_path: string | null;
  pdf_path: string | null;
  status: string;
  validated_at: string;
  driver_id: string;
  driver_name: string | null;
}

interface EmailLog {
  id: string;
  to_email: string;
  status: string;
  error: string | null;
  created_at: string;
}

// Page detail d'un Bon de Livraison - utilise l'API REST
export default function BdlDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [bdl, setBdl] = useState<DeliveryNote | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [sendingToClient, setSendingToClient] = useState(false);

  // Charger les donnees du BDL
  useEffect(() => {
    const load = async () => {
      // Verifier l'authentification via l'API REST
      const authRes = await fetch("/api/auth/me");
      if (!authRes.ok) {
        router.push("/login");
        return;
      }

      // Charger le BDL (l'API retourne driver_name directement)
      const bdlRes = await fetch(`/api/delivery-notes/${id}`);
      if (!bdlRes.ok) {
        alert("BDL introuvable");
        router.push("/");
        return;
      }

      const bdlData = await bdlRes.json();
      setBdl(bdlData);

      // Charger les logs email
      const logsRes = await fetch(`/api/email-logs?delivery_note_id=${id}`);
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setEmailLogs(Array.isArray(logsData) ? logsData : []);
      }

      // URL de la signature (servie directement par l'API, authentifiee par cookie)
      if (bdlData.signature_path) {
        setSignatureUrl(`/api/files/signatures/${bdlData.signature_path}`);
      }

      setLoading(false);
    };

    load();
  }, [id, router]);

  // Telecharger / apercu du PDF via l'API REST
  const handleDownloadPdf = () => {
    if (!bdl?.pdf_path) {
      alert("Aucun PDF disponible");
      return;
    }
    // Ouvrir le PDF dans un nouvel onglet (authentifie par cookie)
    window.open(`/api/files/pdfs/${bdl.pdf_path}`, "_blank");
  };

  // Retry envoi email via l'API REST /api/generate-pdf
  const handleRetry = async () => {
    if (!bdl) return;
    setRetrying(true);

    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_note_id: bdl.id }),
      });

      const result = await response.json();

      if (result.ok) {
        alert(`Email renvoy\u00e9 avec succ\u00e8s ! Statut: ${result.email_status}`);
        // Recharger la page
        window.location.reload();
      } else {
        alert(`Erreur: ${result.error}`);
      }
    } catch (err) {
      alert(`Erreur r\u00e9seau : ${err}`);
    }

    setRetrying(false);
  };

  // Envoyer le PDF au client par email
  const handleSendToClient = async () => {
    if (!bdl) return;
    if (!bdl.client_email) {
      alert("Aucun email client renseign\u00e9 pour ce BDL");
      return;
    }
    if (!bdl.pdf_path) {
      alert("Aucun PDF disponible. Veuillez d'abord reg\u00e9n\u00e9rer le PDF.");
      return;
    }

    setSendingToClient(true);

    try {
      const response = await fetch("/api/send-to-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_note_id: bdl.id }),
      });

      const result = await response.json();

      if (result.ok) {
        alert(`Email envoy\u00e9 avec succ\u00e8s \u00e0 ${bdl.client_email} !`);
        window.location.reload();
      } else {
        alert(`Erreur : ${result.error}`);
      }
    } catch (err) {
      alert(`Erreur r\u00e9seau : ${err}`);
    }

    setSendingToClient(false);
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
        Chargement...
      </div>
    );
  }

  if (!bdl) return null;

  // Couleur du badge
  const statusStyle = (status: string) => {
    switch (status) {
      case "EMAIL_SENT":
      case "sent":
        return { bg: "#dcfce7", color: "#166534" };
      case "EMAIL_FAILED":
      case "failed":
        return { bg: "#fef2f2", color: "#dc2626" };
      default:
        return { bg: "#fef9c3", color: "#a16207" };
    }
  };

  const sc = statusStyle(bdl.status);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      {/* Navigation */}
      <button
        onClick={() => router.push("/")}
        style={{
          padding: "8px 20px",
          background: "#6b7280",
          color: "white",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          marginBottom: 20,
          fontSize: 14,
        }}
      >
        Retour \u00e0 la liste
      </button>

      {/* En-tete */}
      <div
        style={{
          background: "white",
          padding: 30,
          borderRadius: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <h1 style={{ color: "#1e40af", margin: 0, fontSize: 22 }}>
            {bdl.bdl_number}
          </h1>
          <span
            style={{
              background: sc.bg,
              color: sc.color,
              padding: "6px 16px",
              borderRadius: 20,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {bdl.status === "EMAIL_SENT"
              ? "Email envoy\u00e9"
              : bdl.status === "EMAIL_FAILED"
              ? "Email \u00e9chou\u00e9"
              : "Valid\u00e9"}
          </span>
        </div>

        {/* Grille d'informations */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginBottom: 20,
          }}
        >
          <div>
            <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
              CLIENT / SOCI\u00c9T\u00c9
            </label>
            <p style={{ margin: "4px 0 0", fontSize: 16 }}>{bdl.client_name}</p>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
              EMAIL CLIENT
            </label>
            <p style={{ margin: "4px 0 0", fontSize: 16 }}>
              {bdl.client_email || "Non renseign\u00e9"}
            </p>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
              ADRESSE
            </label>
            <p style={{ margin: "4px 0 0", fontSize: 16 }}>{bdl.address}</p>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
              LIVREUR
            </label>
            <p style={{ margin: "4px 0 0", fontSize: 16 }}>{bdl.driver_name || "Inconnu"}</p>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
              DATE VALIDATION
            </label>
            <p style={{ margin: "4px 0 0", fontSize: 16 }}>
              {new Date(bdl.validated_at).toLocaleString("fr-FR")}
            </p>
          </div>
        </div>

        {/* Details livraison */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
            D\u00c9TAILS DE LA LIVRAISON
          </label>
          <div
            style={{
              background: "#f8fafc",
              padding: 16,
              borderRadius: 8,
              marginTop: 8,
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
            }}
          >
            {bdl.details}
          </div>
        </div>

        {/* Signature */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
            SIGNATURE CLIENT
          </label>
          <div style={{ marginTop: 8 }}>
            {signatureUrl ? (
              <img
                src={signatureUrl}
                alt="Signature"
                style={{
                  maxWidth: 300,
                  maxHeight: 150,
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                }}
              />
            ) : (
              <p style={{ color: "#9ca3af" }}>Aucune signature</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={handleDownloadPdf}
            disabled={!bdl.pdf_path}
            style={{
              padding: "10px 24px",
              background: bdl.pdf_path ? "#2563eb" : "#d1d5db",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: bdl.pdf_path ? "pointer" : "not-allowed",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            T\u00e9l\u00e9charger le PDF
          </button>

          {bdl.status === "EMAIL_FAILED" && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              style={{
                padding: "10px 24px",
                background: retrying ? "#fca5a5" : "#ef4444",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: retrying ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {retrying ? "Renvoi en cours..." : "Renvoyer l'email"}
            </button>
          )}

          {/* Bouton envoyer au client */}
          <button
            onClick={handleSendToClient}
            disabled={sendingToClient || !bdl.client_email || !bdl.pdf_path}
            style={{
              padding: "10px 24px",
              background:
                sendingToClient || !bdl.client_email || !bdl.pdf_path
                  ? "#d1d5db"
                  : "#16a34a",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor:
                sendingToClient || !bdl.client_email || !bdl.pdf_path
                  ? "not-allowed"
                  : "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
            title={
              !bdl.client_email
                ? "Aucun email client renseign\u00e9"
                : !bdl.pdf_path
                ? "Aucun PDF disponible"
                : `Envoyer le PDF \u00e0 ${bdl.client_email}`
            }
          >
            {sendingToClient
              ? "Envoi en cours..."
              : `Envoyer au client${bdl.client_email ? ` (${bdl.client_email})` : ""}`}
          </button>
        </div>
      </div>

      {/* Historique des emails */}
      <div
        style={{
          background: "white",
          padding: 24,
          borderRadius: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ fontSize: 16, marginBottom: 16, color: "#374151" }}>
          Historique des emails
        </h2>

        {emailLogs.length === 0 ? (
          <p style={{ color: "#9ca3af" }}>Aucun email envoy\u00e9</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: 8, textAlign: "left" }}>Destinataire</th>
                <th style={{ padding: 8, textAlign: "center" }}>Statut</th>
                <th style={{ padding: 8, textAlign: "left" }}>Erreur</th>
                <th style={{ padding: 8, textAlign: "left" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {emailLogs.map((log) => {
                const ls = statusStyle(log.status);
                return (
                  <tr key={log.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: 8 }}>{log.to_email}</td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <span
                        style={{
                          background: ls.bg,
                          color: ls.color,
                          padding: "2px 10px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {log.status === "sent" ? "Envoy\u00e9" : "\u00c9chou\u00e9"}
                      </span>
                    </td>
                    <td style={{ padding: 8, color: "#ef4444", fontSize: 12 }}>
                      {log.error || "-"}
                    </td>
                    <td style={{ padding: 8 }}>
                      {new Date(log.created_at).toLocaleString("fr-FR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
