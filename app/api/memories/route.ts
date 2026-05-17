import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing Supabase server config. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  );
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

export async function POST(request: Request) {
  const body = await request.json();
  const { type, name, content, preview } = body;

  if (!type || !content || !preview) {
    return NextResponse.json(
      { error: "Missing required memory fields." },
      { status: 400 }
    );
  }

    const { data, error } = await supabaseAdmin
    .from("memories")
    .insert([
      {
        type,
        name: name?.trim() || "Anonymous",
        content,
        preview,
      },
    ])
    .select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("memories")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
