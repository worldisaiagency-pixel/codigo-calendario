import { getStore } from "@netlify/blobs";

interface UnsubscribeBody {
  businessId: string;
  endpoint: string;
}

const handler = async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: UnsubscribeBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { businessId, endpoint } = body;
  if (!businessId || !endpoint) {
    return new Response("Missing businessId or endpoint", { status: 400 });
  }

  const store = getStore("push-subscriptions");
  await store.delete(`${businessId}:${endpoint}`);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};

export default handler;
