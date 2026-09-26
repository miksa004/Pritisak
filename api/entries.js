import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
});

const KEY = "bp_entries";

function categorize(sys, dia) {
  if (sys >= 180 || dia >= 120) return "crisis";
  if (sys >= 140 || dia >= 90) return "stage2";
  if (sys >= 130 || dia >= 80) return "stage1";
  if (sys >= 120) return "elevated";
  return "normal";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      const entries = (await redis.get(KEY)) || [];
      return res.status(200).json({ entries });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const sys = parseInt(body.sys, 10);
      const dia = parseInt(body.dia, 10);
      const pulse = body.pulse ? parseInt(body.pulse, 10) : null;
      const date = typeof body.date === "string" ? body.date : null;
      const period = body.period === "veče" ? "veče" : "jutro";
      const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;

      if (!sys || !dia || !date || isNaN(sys) || isNaN(dia)) {
        return res.status(400).json({ error: "sys, dia, and date are required" });
      }

      const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        date,
        period,
        sys,
        dia,
        pulse: pulse && !isNaN(pulse) ? pulse : null,
        note,
        category: categorize(sys, dia),
        createdAt: new Date().toISOString()
      };

      const entries = (await redis.get(KEY)) || [];
      entries.push(entry);
      await redis.set(KEY, entries);

      return res.status(200).json({ entries, added: entry });
    }

    if (req.method === "DELETE") {
      const id = (req.query && req.query.id) || null;
      if (!id) return res.status(400).json({ error: "id is required" });

      const entries = (await redis.get(KEY)) || [];
      const next = entries.filter((e) => e.id !== id);
      await redis.set(KEY, next);

      return res.status(200).json({ entries: next });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: "Storage unavailable", detail: String(err && err.message || err) });
  }
}
