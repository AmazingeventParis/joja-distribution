// API Route : gestion des clients (CRUD)
// Utilise le service_role pour accès admin à Supabase
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET : lister tous les clients
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST : créer un nouveau client
export async function POST(req: NextRequest) {
  const { name, email, address } = await req.json();

  if (!name || !name.trim()) {
    return NextResponse.json(
      { error: "Le nom du client est requis" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("clients")
    .insert({
      name: name.trim(),
      email: email?.trim() || null,
      address: address?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Erreur création client : " + error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, client: data });
}

// PUT : modifier un client
export async function PUT(req: NextRequest) {
  const { id, name, email, address } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  if (!name || !name.trim()) {
    return NextResponse.json(
      { error: "Le nom du client est requis" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("clients")
    .update({
      name: name.trim(),
      email: email?.trim() || null,
      address: address?.trim() || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Erreur modification : " + error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, client: data });
}

// DELETE : supprimer un client
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("clients")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Erreur suppression : " + error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
