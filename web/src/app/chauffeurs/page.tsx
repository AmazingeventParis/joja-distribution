"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Driver {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export default function ChauffeursPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulaire d'ajout
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Suppression
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Vérifier l'authentification
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
      } else {
        loadDrivers();
      }
    });
  }, [router]);

  // Charger la liste des chauffeurs
  const loadDrivers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/drivers");
      const data = await res.json();
      if (Array.isArray(data)) {
        setDrivers(data);
      }
    } catch (e) {
      console.error("Erreur chargement chauffeurs:", e);
    }
    setLoading(false);
  };

  // Créer un chauffeur
  const handleCreate = async () => {
    setFormError("");
    setFormSuccess("");

    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      setFormError("Tous les champs sont obligatoires.");
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim(),
          password: formPassword.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Erreur inconnue");
      } else {
        setFormSuccess(`Chauffeur "${data.driver.name}" cree avec succes !`);
        setFormName("");
        setFormEmail("");
        setFormPassword("");
        setShowForm(false);
        loadDrivers();
      }
    } catch (e) {
      setFormError("Erreur réseau : " + String(e));
    }
    setFormLoading(false);
  };

  // Supprimer un chauffeur
  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/drivers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setDeleteConfirm(null);
        loadDrivers();
      }
    } catch (e) {
      console.error("Erreur suppression:", e);
    }
    setDeleteLoading(false);
  };

  // Déconnexion
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
      {/* Barre de navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 30,
          background: "white",
          padding: "16px 24px",
          borderRadius: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <h1 style={{ color: "#1e40af", margin: 0, fontSize: 20 }}>
            JOJA DISTRIBUTION
          </h1>
          <nav style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => router.push("/")}
              style={{
                padding: "8px 16px",
                background: "transparent",
                color: "#6b7280",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              Bons de Livraison
            </button>
            <button
              style={{
                padding: "8px 16px",
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Chauffeurs
            </button>
            <button
              onClick={() => router.push("/clients")}
              style={{
                padding: "8px 16px",
                background: "transparent",
                color: "#6b7280",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              Clients
            </button>
          </nav>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: "8px 20px",
            background: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Déconnexion
        </button>
      </div>

      {/* Messages */}
      {formSuccess && (
        <div
          style={{
            padding: 14,
            background: "#dcfce7",
            color: "#166534",
            borderRadius: 8,
            marginBottom: 16,
            fontWeight: 500,
          }}
        >
          {formSuccess}
        </div>
      )}

      {/* Bouton Ajouter */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: "#1e40af", fontSize: 18 }}>
          Gestion des chauffeurs
        </h2>
        <button
          onClick={() => { setShowForm(!showForm); setFormError(""); setFormSuccess(""); }}
          style={{
            padding: "10px 24px",
            background: showForm ? "#6b7280" : "#16a34a",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {showForm ? "Annuler" : "+ Ajouter un chauffeur"}
        </button>
      </div>

      {/* Formulaire d'ajout */}
      {showForm && (
        <div
          style={{
            background: "white",
            borderRadius: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            padding: 24,
            marginBottom: 20,
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", color: "#1e40af" }}>
            Nouveau chauffeur
          </h3>

          {formError && (
            <div
              style={{
                padding: 12,
                background: "#fef2f2",
                color: "#dc2626",
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 14,
              }}
            >
              {formError}
            </div>
          )}

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "#374151" }}>
                Nom complet
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Jean Dupont"
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "#374151" }}>
                Adresse email
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="Ex: jean@joja.com"
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "#374151" }}>
                Mot de passe
              </label>
              <input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Min. 6 caractères"
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 16, textAlign: "right" }}>
            <button
              onClick={handleCreate}
              disabled={formLoading}
              style={{
                padding: "10px 28px",
                background: formLoading ? "#9ca3af" : "#2563eb",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: formLoading ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {formLoading ? "Création en cours..." : "Créer le chauffeur"}
            </button>
          </div>
        </div>
      )}

      {/* Liste des chauffeurs */}
      <div
        style={{
          background: "white",
          borderRadius: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <p style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
            Chargement...
          </p>
        ) : drivers.length === 0 ? (
          <p style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
            Aucun chauffeur enregistré
          </p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: 12, textAlign: "left" }}>Nom</th>
                <th style={{ padding: 12, textAlign: "left" }}>Email</th>
                <th style={{ padding: 12, textAlign: "left" }}>Date de création</th>
                <th style={{ padding: 12, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: 12, fontWeight: 600, color: "#1e40af" }}>
                    {driver.name}
                  </td>
                  <td style={{ padding: 12 }}>{driver.email}</td>
                  <td style={{ padding: 12 }}>
                    {new Date(driver.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td style={{ padding: 12, textAlign: "center" }}>
                    {deleteConfirm === driver.id ? (
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button
                          onClick={() => handleDelete(driver.id)}
                          disabled={deleteLoading}
                          style={{
                            padding: "6px 12px",
                            background: "#dc2626",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: deleteLoading ? "not-allowed" : "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {deleteLoading ? "..." : "Confirmer"}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          style={{
                            padding: "6px 12px",
                            background: "#6b7280",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(driver.id)}
                        style={{
                          padding: "6px 16px",
                          background: "#fef2f2",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Compteur */}
      <p
        style={{
          textAlign: "right",
          marginTop: 12,
          color: "#6b7280",
          fontSize: 13,
        }}
      >
        {drivers.length} chauffeur(s)
      </p>
    </div>
  );
}
