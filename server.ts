import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // OpenAI Client Initialization
  let openai: OpenAI | null = null;
  const getOpenAI = () => {
    if (!openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not set in environment variables.");
      }
      openai = new OpenAI({
        apiKey: apiKey,
        baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      });
    }
    return openai;
  };

  // API routes
  app.post("/api/openai/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      const client = getOpenAI();
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: messages,
      });
      res.json(response);
    } catch (error: any) {
      console.error("OpenAI Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/openai/filter-buildings", async (req, res) => {
    try {
      const { buildings, innerRadius } = req.body;
      const client = getOpenAI();
      
      const prompt = `
Given a list of OSM buildings, perform the following:

STEP 1 — Filter by distance:
Keep only buildings where distance_meters <= ${innerRadius}m.

STEP 2 — Identify confirmed civilian buildings:
From the Step 1 filtered list, keep only buildings where at least one 
of the following applies:
  - amenity is a recognised civilian type (e.g. place_of_worship, school)
  - building is a recognised civilian type (e.g. residential, college, 
    construction, retail)
  - name clearly indicates a civilian purpose

Discard a building if ANY of the following are true:
- building = "yes" AND amenity is null AND name is null
- military field is not null
- No field provides a specific, recognisable civilian indicator

Treat all discarded buildings as military or ambiguous

STEP 3 — Decision and Output:
Populate the civilian_buildings array with all buildings that 
satisfy BOTH Step 1 and Step 2.
{  "civilian_buildings": [
    {
      "id": <integer>,
      "name": <string or null>,
      "distance_meters": <float>,
      "building": <string or null>,
      "amenity": <string or null>,
 
    }
  ]
}

List of buildings:
${JSON.stringify(buildings, null, 2)}
`;

      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: "You are a specialized geospatial data analyst. Return ONLY valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("Empty response from OpenAI");
      
      res.json(JSON.parse(content));
    } catch (error: any) {
      console.error("OpenAI Filter Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
