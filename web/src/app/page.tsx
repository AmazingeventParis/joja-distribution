"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Types
interface DeliveryNote {
  id: string;
  bdl_number: string;
  client_name: string;
  client_email: string | null;
  address: string;
  status: string;
  validated_at: string;
  created_at: string;
  driver_id: string;
  profiles?: { name: string };
}

// Page principale : liste des BDL avec filtres
export default function HomePage() {
  const router = useRouter();
  const [bdls, setBdls] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string } | null>(null);

  // Filtres
  const [filterClient, setFilterClient] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Vérifier l'authentification au chargement
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
      } else {
        setUser(data.user);
        loadBdls();
      }
    });
  }, [router]);

  // Charger les BDL depuis Supabase
  const loadBdls = async () => {
    setLoading(true);

    let query = supabase
      .from("delivery_notes")
      .select("*, profiles(name)")
      .order("created_at", { ascending: false });

    // Appliquer les filtres
    if (filterClient) {
      query = query.ilike("client_name", `%${filterClient}%`);
    }
    if (filterStatus) {
      query = query.eq("status", filterStatus);
    }
    if (filterDate) {
      query = query.gte("created_at", filterDate + "T00:00:00");
      query = query.lte("created_at", filterDate + "T23:59:59");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erreur chargement BDL:", error);
    } else {
      setBdls(data || []);
    }
    setLoading(false);
  };

  // Recharger quand les filtres changent
  useEffect(() => {
    if (user) loadBdls();
  }, [filterClient, filterStatus, filterDate, user]);

  // Déconnexion
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Couleur du badge de statut
  const statusColor = (status: string) => {
    switch (status) {
      case "EMAIL_SENT":
        return { bg: "#dcfce7", color: "#166534" };
      case "EMAIL_FAILED":
        return { bg: "#fef2f2", color: "#dc2626" };
      default:
        return { bg: "#fef9c3", color: "#a16207" };
    }
  };

  // Libellé du statut en français
  const statusLabel = (status: string) => {
    switch (status) {
      case "EMAIL_SENT":
        return "Email envoyé";
      case "EMAIL_FAILED":
        return "Email échoué";
      default:
        return "Validé";
    }
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

      {/* Filtres */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="Filtrer par client..."
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 6,
            border: "1px solid #d1d5db",
            fontSize: 14,
            flex: 1,
            minWidth: 200,
          }}
        />

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 6,
            border: "1px solid #d1d5db",
            fontSize: 14,
          }}
        >
          <option value="">Tous les statuts</option>
          <option value="VALIDATED">Validé</option>
          <option value="EMAIL_SENT">Email envoyé</option>
          <option value="EMAIL_FAILED">Email échoué</option>
        </select>

        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 6,
            border: "1px solid #d1d5db",
            fontSize: 14,
          }}
        />

        <button
          onClick={() => {
            setFilterClient("");
            setFilterStatus("");
            setFilterDate("");
          }}
          style={{
            padding: "10px 20px",
            background: "#6b7280",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Réinitialiser
        </button>
      </div>

      {/* Tableau des BDL */}
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
        ) : bdls.length === 0 ? (
          <p style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
            Aucun bon de livraison trouvé
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
                <th style={{ padding: 12, textAlign: "left" }}>N° BDL</th>
                <th style={{ padding: 12, textAlign: "left" }}>Client</th>
                <th style={{ padding: 12, textAlign: "left" }}>Livreur</th>
                <th style={{ padding: 12, textAlign: "left" }}>Date</th>
                <th style={{ padding: 12, textAlign: "center" }}>Statut</th>
                <th style={{ padding: 12, textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {bdls.map((bdl) => {
                const sc = statusColor(bdl.status);
                return (
                  <tr
                    key={bdl.id}
                    style={{
                      borderBottom: "1px solid #f3f4f6",
                      cursor: "pointer",
                    }}
                    onClick={() => router.push(`/bdl/${bdl.id}`)}
                  >
                    <td style={{ padding: 12, fontWeight: 600, color: "#1e40af" }}>
                      {bdl.bdl_number}
                    </td>
                    <td style={{ padding: 12 }}>{bdl.client_name}</td>
                    <td style={{ padding: 12 }}>
                      {(bdl as unknown as { profiles: { name: string } }).profiles?.name || "-"}
                    </td>
                    <td style={{ padding: 12 }}>
                      {new Date(bdl.validated_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td style={{ padding: 12, textAlign: "center" }}>
                      <span
                        style={{
                          background: sc.bg,
                          color: sc.color,
                          padding: "4px 12px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {statusLabel(bdl.status)}
                      </span>
                    </td>
                    <td style={{ padding: 12, textAlign: "center" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/bdl/${bdl.id}`);
                        }}
                        style={{
                          padding: "6px 16px",
                          background: "#2563eb",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 13,
                        }}
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                );
              })}
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
        {bdls.length} bon(s) de livraison
      </p>
    </div>
  );
}
