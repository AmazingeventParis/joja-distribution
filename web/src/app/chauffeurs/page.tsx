"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Driver {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

// Page gestion des chauffeurs - utilise l'API REST
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

  // Modification
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showFormPassword, setShowFormPassword] = useState(false);

  // Verifier l'authentification via l'API REST
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) {
          router.push("/login");
        } else {
          loadDrivers();
        }
      })
      .catch(() => {
        router.push("/login");
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

  // Creer un chauffeur
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

  // Ouvrir le formulaire de modification
  const openEdit = (driver: Driver) => {
    setEditDriver(driver);
    setEditName(driver.name);
    setEditEmail(driver.email);
    setEditPassword("");
    setEditError("");
    setEditSuccess("");
    setShowEditPassword(false);
  };

  // Modifier un chauffeur
  const handleUpdate = async () => {
    if (!editDriver) return;
    setEditError("");
    setEditSuccess("");

    if (!editName.trim() || !editEmail.trim()) {
      setEditError("Le nom et l'email sont obligatoires.");
      return;
    }

    setEditLoading(true);
    try {
      const body: Record<string, string> = {
        id: editDriver.id,
        name: editName.trim(),
        email: editEmail.trim(),
      };
      if (editPassword.trim()) {
        body.password = editPassword.trim();
      }

      const res = await fetch("/api/drivers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setEditError(data.error || "Erreur inconnue");
      } else {
        setEditSuccess("Chauffeur modifié avec succès !");
        loadDrivers();
        setTimeout(() => setEditDriver(null), 1200);
      }
    } catch (e) {
      setEditError("Erreur réseau : " + String(e));
    }
    setEditLoading(false);
  };

  // Deconnexion via l'API REST
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
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
              <div style={{ position: "relative" }}>
                <input
                  type={showFormPassword ? "text" : "password"}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Min. 6 caractères"
                  style={{
                    width: "100%",
                    padding: 10,
                    paddingRight: 40,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowFormPassword(!showFormPassword)}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    color: "#2563eb",
                    padding: 4,
                    fontWeight: 500,
                  }}
                >
                  {showFormPassword ? "Masquer" : "Voir"}
                </button>
              </div>
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
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button
                          onClick={() => openEdit(driver)}
                          style={{
                            padding: "6px 16px",
                            background: "#eff6ff",
                            color: "#2563eb",
                            border: "1px solid #bfdbfe",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          Voir / Modifier
                        </button>
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
                      </div>
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

      {/* Modale modification chauffeur */}
      {editDriver && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setEditDriver(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 32,
              width: 440,
              maxWidth: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 20px 0", color: "#1e40af", fontSize: 18 }}>
              Modifier le chauffeur
            </h3>

            {editError && (
              <div style={{ padding: 10, background: "#fef2f2", color: "#dc2626", borderRadius: 6, marginBottom: 16, fontSize: 14 }}>
                {editError}
              </div>
            )}
            {editSuccess && (
              <div style={{ padding: 10, background: "#dcfce7", color: "#166534", borderRadius: 6, marginBottom: 16, fontSize: 14 }}>
                {editSuccess}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "#374151" }}>
                Nom complet
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "#374151" }}>
                Adresse email
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "#374151" }}>
                Nouveau mot de passe (laisser vide pour ne pas changer)
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showEditPassword ? "text" : "password"}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Min. 6 caractères"
                  style={{ width: "100%", padding: 10, paddingRight: 70, borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" }}
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#2563eb", padding: 4, fontWeight: 500 }}
                >
                  {showEditPassword ? "Masquer" : "Voir"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setEditDriver(null)}
                style={{ padding: "10px 20px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer", fontWeight: 500, fontSize: 14 }}
              >
                Fermer
              </button>
              <button
                onClick={handleUpdate}
                disabled={editLoading}
                style={{ padding: "10px 24px", background: editLoading ? "#9ca3af" : "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: editLoading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14 }}
              >
                {editLoading ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
