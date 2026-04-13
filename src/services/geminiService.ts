import { GoogleGenAI } from "@google/genai";
import { RoutePoint } from "../types";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export async function getTravelSummary(routePoints: RoutePoint[]): Promise<string> {
  const weatherContext = routePoints.map(p => {
    const time = new Date(p.eta).toLocaleString();
    const weather = p.weather ? `${p.weather.temp}°F, ${p.weather.description}` : "Unknown weather";
    return `At ${time} near ${p.location.lat}, ${p.location.lng}: ${weather}`;
  }).join("\n");

  const prompt = `
    You are a travel weather advisor. Analyze the following travel route and weather snapshots.
    Provide a concise, helpful summary for the driver in NO MORE THAN 4 SENTENCES. 
    Highlight any potential hazards (heavy rain, high winds, extreme cold/heat) and suggest if they should adjust their departure time or speed.
    Keep it professional but friendly.

    Route Data:
    ${weatherContext}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Could not generate summary.";
  } catch (error) {
    console.error("Gemini summary failed:", error);
    return "Error generating AI summary.";
  }
}
