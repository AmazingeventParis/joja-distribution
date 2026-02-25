"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Page de connexion admin
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Connexion avec Supabase Auth
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Erreur connexion : " + authError.message);
      setLoading(false);
      return;
    }

    // Vérifier que c'est un admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError) {
      setError("Erreur profil : " + profileError.message);
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (!profile || profile.role !== "admin") {
      setError("Accès réservé aux administrateurs (rôle: " + (profile?.role || "aucun") + ")");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    router.push("/");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          background: "white",
          padding: 40,
          borderRadius: 12,
          boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
          width: 380,
        }}
      >
        <h1
          style={{
            textAlign: "center",
            color: "#1e40af",
            marginBottom: 8,
            fontSize: 22,
          }}
        >
          JOJA DISTRIBUTION
        </h1>
        <p
          style={{
            textAlign: "center",
            color: "#6b7280",
            marginBottom: 30,
            fontSize: 14,
          }}
        >
          Espace Administration
        </p>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              color: "#dc2626",
              padding: 10,
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 14,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              marginBottom: 6,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
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

        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: "block",
              marginBottom: 6,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Mot de passe
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
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

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            background: loading ? "#93c5fd" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
