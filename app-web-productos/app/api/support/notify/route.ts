import { NextResponse } from "next/server";

type NotifyBody = {
  kind?: "support" | "complaint";
  reference?: string;
  payload?: Record<string, unknown>;
};

function text(value: unknown) {
  return typeof value === "string" ? value.slice(0, 5000) : "";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as NotifyBody | null;
  const apiKey = process.env.RESEND_API_KEY;
  const supportEmail = process.env.SUPPORT_EMAIL;
  const from = process.env.EMAIL_FROM;

  if (!body?.kind || !body.payload) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  if (!apiKey || !supportEmail || !from) {
    return NextResponse.json({
      delivered: false,
      mode: "database_only",
      message: "El registro fue guardado, pero el correo externo no está configurado.",
    });
  }

  const payload = body.payload;
  const subject =
    body.kind === "complaint"
      ? `[AhorraPe] Nuevo reclamo ${text(body.reference)}`
      : `[AhorraPe] Soporte: ${text(payload.subject)}`;
  const lines = Object.entries(payload)
    .map(([key, value]) => `${key}: ${text(value) || String(value ?? "")}`)
    .join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [supportEmail],
      reply_to: text(payload.email) || undefined,
      subject,
      text: `Referencia: ${text(body.reference)}\n\n${lines}`,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({
      delivered: false,
      mode: "database_only",
      message: "El registro fue guardado; Resend no pudo entregar el aviso.",
    });
  }

  return NextResponse.json({ delivered: true, mode: "support_email" });
}
