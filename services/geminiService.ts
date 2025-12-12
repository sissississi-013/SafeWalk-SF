import { GoogleGenAI, Type } from "@google/genai";
import { LocationInfo, RouteData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Using Flash for quick geocoding
const GEOCODING_MODEL = "gemini-2.5-flash";
// Using Pro for complex reasoning about safety and route planning
const ROUTING_MODEL = "gemini-3-pro-preview";

export const getGeocode = async (query: string, userLat?: number, userLng?: number): Promise<LocationInfo> => {
  try {
    const prompt = `Identify the precise geographic coordinates (latitude and longitude) for the place: "${query}" in or near San Francisco, CA. 
    If the user provides "Current Location" or similar, use the provided user coordinates if available.
    
    Return the result in strict JSON format.`;

    const response = await ai.models.generateContent({
      model: GEOCODING_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Canonical name of the location" },
            formattedAddress: { type: Type.STRING, description: "Full address" },
            coordinate: {
              type: Type.OBJECT,
              properties: {
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER }
              },
              required: ["lat", "lng"]
            }
          },
          required: ["name", "coordinate"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as LocationInfo;
  } catch (error) {
    console.error("Geocoding error:", error);
    throw new Error("Could not find location. Please try a more specific address.");
  }
};

export const generateRoutes = async (start: LocationInfo, end: LocationInfo): Promise<RouteData[]> => {
  try {
    const prompt = `
      Plan 3 distinct walking routes from "${start.name}" (${start.coordinate.lat}, ${start.coordinate.lng}) to "${end.name}" (${end.coordinate.lat}, ${end.coordinate.lng}) in San Francisco.
      
      The routes should be:
      1. "Safe & Well-Lit": Prioritize main streets (e.g., Market, Van Ness, Geary) and high-traffic areas. Strictly avoid dangerous alleys or known high-crime blocks (like parts of the Tenderloin at night) if possible.
      2. "Scenic & Relaxed": Prioritize parks, waterfronts (Embarcadero), and views, even if slightly longer.
      3. "Fastest Direct": The most direct geometric path for a brisk walk.

      For EACH route, generate a detailed list of lat/lng waypoints (at least 15-20 points) that roughly follow the street grid so I can draw a polyline on a map. The waypoints must be realistic and sequential.

      Return JSON.
    `;

    const response = await ai.models.generateContent({
      model: ROUTING_MODEL, // Using Pro for better reasoning about SF geography
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 2048 }, // Allow some thinking for route planning
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            routes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["SAFE", "FAST", "SCENIC"] },
                  description: { type: Type.STRING },
                  riskLevel: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
                  estimatedTime: { type: Type.STRING },
                  distance: { type: Type.STRING },
                  waypoints: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.ARRAY,
                      items: { type: Type.NUMBER }, // [lat, lng]
                      description: "Latitude and Longitude pair"
                    }
                  }
                },
                required: ["id", "name", "type", "description", "riskLevel", "estimatedTime", "distance", "waypoints"]
              }
            }
          },
          required: ["routes"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No route data generated");

    const data = JSON.parse(text);
    return data.routes;

  } catch (error) {
    console.error("Route generation error:", error);
    throw new Error("Unable to calculate routes at this time.");
  }
};
