"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Client {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  created_at: string;
}

// Page gestion des clients - utilise l'API REST
export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulaire d'ajout
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Modification inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Suppression
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Verifier l'authentification via l'API REST
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) {
          router.push("/login");
        } else {
          loadClients();
        }
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  // Charger la liste des clients via l'API REST
  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(Array.isArray(data) ? data : []);
      } else {
        console.error("Erreur chargement clients:", res.statusText);
      }
    } catch (e) {
      console.error("Erreur chargement clients:", e);
    }
    setLoading(false);
  };

  // Creer un client
  const handleCreate = async () => {
    setFormError("");
    setFormSuccess("");

    if (!formName.trim()) {
      setFormError("Le nom du client est obligatoire.");
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim() || null,
          address: formAddress.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Erreur inconnue");
      } else {
        setFormSuccess(`Client "${data.client.name}" cree avec succes !`);
        setFormName("");
        setFormEmail("");
        setFormAddress("");
        setShowForm(false);
        loadClients();
      }
    } catch (e) {
      setFormError("Erreur réseau : " + String(e));
    }
    setFormLoading(false);
  };

  // Commencer la modification
  const startEdit = (client: Client) => {
    setEditId(client.id);
    setEditName(client.name);
    setEditEmail(client.email || "");
    setEditAddress(client.address || "");
  };

  // Sauvegarder la modification
  const handleEdit = async () => {
    if (!editName.trim()) return;

    setEditLoading(true);
    try {
      const res = await fetch("/api/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editId,
          name: editName.trim(),
          email: editEmail.trim() || null,
          address: editAddress.trim() || null,
        }),
      });

      if (res.ok) {
        setEditId(null);
        loadClients();
      }
    } catch (e) {
      console.error("Erreur modification:", e);
    }
    setEditLoading(false);
  };

  // Supprimer un client
  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/clients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setDeleteConfirm(null);
        loadClients();
      }
    } catch (e) {
      console.error("Erreur suppression:", e);
    }
    setDeleteLoading(false);
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
              onClick={() => router.push("/chauffeurs")}
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
              Chauffeurs
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
          Gestion des clients
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
          {showForm ? "Annuler" : "+ Ajouter un client"}
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
            Nouveau client
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
                Nom *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Boulangerie Dupont"
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
                Email (optionnel)
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="Ex: contact@dupont.fr"
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
                Adresse (optionnel)
              </label>
              <input
                type="text"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Ex: 12 rue de la Paix, 75001 Paris"
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
              {formLoading ? "Création en cours..." : "Créer le client"}
            </button>
          </div>
        </div>
      )}

      {/* Liste des clients */}
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
        ) : clients.length === 0 ? (
          <p style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
            Aucun client enregistré
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
                <th style={{ padding: 12, textAlign: "left" }}>Adresse</th>
                <th style={{ padding: 12, textAlign: "left" }}>Date de création</th>
                <th style={{ padding: 12, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  {editId === client.id ? (
                    // Mode edition
                    <>
                      <td style={{ padding: 8 }}>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{
                            width: "100%",
                            padding: 6,
                            borderRadius: 4,
                            border: "1px solid #2563eb",
                            fontSize: 13,
                            boxSizing: "border-box",
                          }}
                        />
                      </td>
                      <td style={{ padding: 8 }}>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          style={{
                            width: "100%",
                            padding: 6,
                            borderRadius: 4,
                            border: "1px solid #2563eb",
                            fontSize: 13,
                            boxSizing: "border-box",
                          }}
                        />
                      </td>
                      <td style={{ padding: 8 }}>
                        <input
                          type="text"
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          style={{
                            width: "100%",
                            padding: 6,
                            borderRadius: 4,
                            border: "1px solid #2563eb",
                            fontSize: 13,
                            boxSizing: "border-box",
                          }}
                        />
                      </td>
                      <td style={{ padding: 12 }}>
                        {new Date(client.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td style={{ padding: 8, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button
                            onClick={handleEdit}
                            disabled={editLoading}
                            style={{
                              padding: "6px 12px",
                              background: "#16a34a",
                              color: "white",
                              border: "none",
                              borderRadius: 4,
                              cursor: editLoading ? "not-allowed" : "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {editLoading ? "..." : "Sauver"}
                          </button>
                          <button
                            onClick={() => setEditId(null)}
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
                      </td>
                    </>
                  ) : (
                    // Mode lecture
                    <>
                      <td style={{ padding: 12, fontWeight: 600, color: "#1e40af" }}>
                        {client.name}
                      </td>
                      <td style={{ padding: 12 }}>{client.email || "-"}</td>
                      <td style={{ padding: 12 }}>{client.address || "-"}</td>
                      <td style={{ padding: 12 }}>
                        {new Date(client.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td style={{ padding: 12, textAlign: "center" }}>
                        {deleteConfirm === client.id ? (
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            <button
                              onClick={() => handleDelete(client.id)}
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
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            <button
                              onClick={() => startEdit(client)}
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
                              Modifier
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(client.id)}
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
                    </>
                  )}
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
        {clients.length} client(s)
      </p>
    </div>
  );
}
