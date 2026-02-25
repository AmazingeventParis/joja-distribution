// API Route : gestion des chauffeurs (création / suppression)
// Utilise le service_role pour accès admin à Supabase Auth
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET : lister tous les chauffeurs
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, name, role, created_at")
    .eq("role", "driver")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Récupérer les emails depuis auth.users
  const driversWithEmail = await Promise.all(
    (data || []).map(async (driver) => {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(driver.id);
      return {
        ...driver,
        email: userData?.user?.email || "Inconnu",
      };
    })
  );

  return NextResponse.json(driversWithEmail);
}

// POST : créer un nouveau chauffeur
export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  // Validation
  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Nom, email et mot de passe sont requis" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Le mot de passe doit contenir au moins 6 caractères" },
      { status: 400 }
    );
  }

  // 1) Créer l'utilisateur dans Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Pas besoin de confirmation par email
  });

  if (authError) {
    return NextResponse.json(
      { error: "Erreur création compte : " + authError.message },
      { status: 400 }
    );
  }

  // 2) Créer le profil avec le rôle "driver"
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert({
      id: authData.user.id,
      name,
      role: "driver",
    });

  if (profileError) {
    return NextResponse.json(
      { error: "Erreur création profil : " + profileError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    driver: {
      id: authData.user.id,
      name,
      email,
    },
  });
}

// DELETE : supprimer un chauffeur
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  // Supprimer l'utilisateur de Supabase Auth (supprime aussi le profil via cascade ou on le fait manuellement)
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);

  if (authError) {
    return NextResponse.json(
      { error: "Erreur suppression : " + authError.message },
      { status: 500 }
    );
  }

  // Supprimer le profil
  await supabaseAdmin.from("profiles").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
