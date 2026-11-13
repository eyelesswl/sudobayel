import { db, isUuid } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Фото игрока. Id игрока — случайный UUID; фото у игрока не меняется, поэтому кэшируем надолго. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return new Response(null, { status: 404 });
  const { data } = await db().from("players").select("avatar").eq("id", params.id).maybeSingle();
  const b64 = (data as { avatar: string | null } | null)?.avatar;
  if (!b64) return new Response(null, { status: 404 });
  return new Response(Buffer.from(b64, "base64"), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
