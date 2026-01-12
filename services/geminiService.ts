import { GoogleGenAI, Type } from "@google/genai";
import { LocationInfo, RouteData, SafetyDetails } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Wait for Google Maps to be ready
function waitForGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof google !== 'undefined' && google.maps) {
      resolve();
      return;
    }

    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      if (typeof google !== 'undefined' && google.maps) {
        clearInterval(checkInterval);
        resolve();
      } else if (attempts > 50) {
        clearInterval(checkInterval);
        reject(new Error("Google Maps failed to load. Please check your API key."));
      }
    }, 100);
  });
}

// Use Google Geocoding API for accurate location lookup
export const getGeocode = async (query: string, userLat?: number, userLng?: number): Promise<LocationInfo> => {
  try {
    if (query.toLowerCase().includes("current location") && userLat && userLng) {
      return {
        name: "Current Location",
        formattedAddress: "Your current location",
        coordinate: { lat: userLat, lng: userLng }
      };
    }

    await waitForGoogleMaps();
    const geocoder = new google.maps.Geocoder();

    const result = await geocoder.geocode({
      address: query + ", San Francisco, CA"
    });

    if (!result.results || result.results.length === 0) {
      throw new Error("Location not found");
    }

    const place = result.results[0];
    return {
      name: place.formatted_address.split(",")[0],
      formattedAddress: place.formatted_address,
      coordinate: {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      }
    };
  } catch (error: any) {
    console.error("Geocoding error:", error);
    throw new Error(error.message || "Could not find location. Please try a more specific address.");
  }
};

// Use Google Directions API for accurate pedestrian routing
// Returns multiple route alternatives for user to compare
export const generateRoutes = async (start: LocationInfo, end: LocationInfo): Promise<RouteData[]> => {
  try {
    await waitForGoogleMaps();
    const directionsService = new google.maps.DirectionsService();

    // Request with alternatives enabled
    const request: google.maps.DirectionsRequest = {
      origin: new google.maps.LatLng(start.coordinate.lat, start.coordinate.lng),
      destination: new google.maps.LatLng(end.coordinate.lat, end.coordinate.lng),
      travelMode: google.maps.TravelMode.WALKING,
      provideRouteAlternatives: true,
    };

    const result = await directionsService.route(request);

    if (!result.routes || result.routes.length === 0) {
      throw new Error("No routes found");
    }

    console.log(`Google returned ${result.routes.length} route(s)`);

    // Process all routes from Google
    const routes: RouteData[] = result.routes.map((route, index) => {
      const leg = route.legs![0];
      const waypoints: [number, number][] = route.overview_path!.map(point => [
        point.lat(),
        point.lng()
      ]);

      // Extract main street name from Google's route summary
      const mainStreet = route.summary || "";

      // Build description from step-by-step instructions
      const steps = leg.steps!.slice(0, 3).map(step =>
        step.instructions!.replace(/<[^>]*>/g, "")
      ).join(" → ");

      // Initial route naming - will be updated based on real safety analysis
      const routeName = mainStreet ? `Via ${mainStreet}` : `Route ${index + 1}`;

      return {
        id: `route-${index + 1}`,
        name: routeName,
        type: "FAST" as "SAFE" | "FAST", // Will be updated by safety analysis
        description: steps.substring(0, 150),
        riskLevel: "Medium" as "Low" | "Medium" | "High", // Will be updated by safety analysis
        estimatedTime: leg.duration!.text!,
        distance: leg.distance!.text!,
        waypoints: waypoints,
      };
    });

    // If Google only returned 1 route, try to generate alternatives via intermediate waypoints
    if (routes.length === 1 && result.routes[0].legs![0].distance!.value! > 500) {
      console.log("Only 1 route returned, attempting to generate alternatives...");
      const alternativeRoutes = await generateAlternativeRoutes(start, end, directionsService);
      routes.push(...alternativeRoutes);
    }

    // Return routes without Gemini analysis - safety will be determined by real incident data
    return routes;

  } catch (error: any) {
    console.error("Route generation error:", error);
    if (error.message?.includes("ZERO_RESULTS")) {
      throw new Error("No walking routes found between these locations.");
    }
    if (error.message?.includes("REQUEST_DENIED")) {
      throw new Error("API request denied. Please enable Directions API in Google Cloud Console.");
    }
    throw new Error(error.message || "Unable to calculate routes.");
  }
};

// Generate alternative routes by using intermediate waypoints
async function generateAlternativeRoutes(
  start: LocationInfo,
  end: LocationInfo,
  directionsService: google.maps.DirectionsService
): Promise<RouteData[]> {
  const alternatives: RouteData[] = [];

  // Calculate midpoint offset directions for alternative routes
  const midLat = (start.coordinate.lat + end.coordinate.lat) / 2;
  const midLng = (start.coordinate.lng + end.coordinate.lng) / 2;

  // Perpendicular offset for alternative routes (roughly 200m offset)
  const latDiff = end.coordinate.lat - start.coordinate.lat;
  const lngDiff = end.coordinate.lng - start.coordinate.lng;
  const offsetAmount = 0.002; // ~200m

  // Create waypoints that deviate from direct path
  const offsets = [
    { lat: midLat + lngDiff * offsetAmount, lng: midLng - latDiff * offsetAmount }, // Left deviation
    { lat: midLat - lngDiff * offsetAmount, lng: midLng + latDiff * offsetAmount }, // Right deviation
  ];

  for (let i = 0; i < offsets.length; i++) {
    try {
      const request: google.maps.DirectionsRequest = {
        origin: new google.maps.LatLng(start.coordinate.lat, start.coordinate.lng),
        destination: new google.maps.LatLng(end.coordinate.lat, end.coordinate.lng),
        travelMode: google.maps.TravelMode.WALKING,
        waypoints: [{ location: new google.maps.LatLng(offsets[i].lat, offsets[i].lng), stopover: false }],
        optimizeWaypoints: false,
      };

      const result = await directionsService.route(request);

      if (result.routes && result.routes.length > 0) {
        const route = result.routes[0];
        const leg = route.legs![0];
        const waypoints: [number, number][] = route.overview_path!.map(point => [
          point.lat(),
          point.lng()
        ]);

        const mainStreet = route.summary || "";
        const steps = leg.steps!.slice(0, 3).map(step =>
          step.instructions!.replace(/<[^>]*>/g, "")
        ).join(" → ");

        // Calculate total duration and distance across all legs
        let totalDuration = 0;
        let totalDistance = 0;
        route.legs!.forEach(l => {
          totalDuration += l.duration!.value!;
          totalDistance += l.distance!.value!;
        });

        alternatives.push({
          id: `route-${i + 2}`,
          name: mainStreet ? `Via ${mainStreet}` : `Alternative ${i + 1}`,
          type: "FAST",
          description: steps.substring(0, 150),
          riskLevel: "Medium",
          estimatedTime: `${Math.round(totalDuration / 60)} mins`,
          distance: `${(totalDistance / 1609.34).toFixed(1)} mi`,
          waypoints: waypoints,
        });

        console.log(`Generated alternative route ${i + 2}: ${mainStreet || 'Alternative'}`);
      }
    } catch (e) {
      console.log(`Could not generate alternative route ${i + 2}:`, e);
    }
  }

  return alternatives;
}

// Use Gemini to analyze and score route safety with detailed information
async function analyzeRouteSafety(routes: (RouteData & { mainStreet?: string })[], start: LocationInfo, end: LocationInfo): Promise<RouteData[]> {
  try {
    const prompt = `
You are a San Francisco safety expert. Analyze these ${routes.length} walking routes from "${start.name}" to "${end.name}".

Routes to analyze:
${routes.map((r, i) => `Route ${i + 1}: Via "${r.mainStreet || r.name}" - ${r.distance}, ${r.estimatedTime}`).join("\n")}

For EACH route, provide detailed safety analysis based on real San Francisco data:

1. **Homeless Activity Level**: Rate based on known encampment areas (Tenderloin, parts of SoMa, Civic Center, UN Plaza have high activity)

2. **Crime Statistics** (estimate monthly incidents along route):
   - Robbery incidents
   - Assault incidents
   - Theft/pickpocket incidents

3. **Lighting Conditions**: Well-lit (main commercial streets), Moderate (residential), Poorly-lit (alleys, industrial)

4. **Crowd Level**: Busy (tourist areas, downtown), Moderate (residential), Isolated (industrial, parks at night)

5. **Police Presence**: Based on proximity to stations and patrol frequency

6. **Safety Score**: 1-10 (10 being safest)

7. **Pros**: 2-3 specific reasons TO take this route (e.g., "Passes through busy Union Square with security", "Well-lit Market Street corridor")

8. **Cons**: 2-3 specific reasons to AVOID this route (e.g., "Passes 6th & Market known for drug activity", "Isolated stretch near warehouses")

9. **Areas to Avoid**: Specific blocks or intersections on this route that are concerning

10. **Recommendation**: One sentence explaining who should/shouldn't take this route

Be specific about San Francisco locations. Mention actual street names, neighborhoods, and known problem areas like:
- Tenderloin (high crime, homeless encampments)
- 6th Street corridor (drug activity)
- Mid-Market (mixed safety)
- Civic Center/UN Plaza (encampments)
- Parts of SoMa (isolated at night)

Return JSON.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  routeIndex: { type: Type.NUMBER },
                  recommendedType: { type: Type.STRING, enum: ["SAFE", "FAST"] },
                  riskLevel: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
                  routeName: { type: Type.STRING },
                  safetyDetails: {
                    type: Type.OBJECT,
                    properties: {
                      homelessActivity: { type: Type.STRING, enum: ["Low", "Moderate", "High"] },
                      crimeIncidents: {
                        type: Type.OBJECT,
                        properties: {
                          robbery: { type: Type.NUMBER },
                          assault: { type: Type.NUMBER },
                          theft: { type: Type.NUMBER }
                        },
                        required: ["robbery", "assault", "theft"]
                      },
                      lighting: { type: Type.STRING, enum: ["Well-lit", "Moderate", "Poorly-lit"] },
                      crowdLevel: { type: Type.STRING, enum: ["Busy", "Moderate", "Isolated"] },
                      policePresence: { type: Type.STRING, enum: ["High", "Moderate", "Low"] },
                      safetyScore: { type: Type.NUMBER },
                      pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                      cons: { type: Type.ARRAY, items: { type: Type.STRING } },
                      recommendation: { type: Type.STRING },
                      avoidAreas: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["homelessActivity", "crimeIncidents", "lighting", "crowdLevel", "policePresence", "safetyScore", "pros", "cons", "recommendation", "avoidAreas"]
                  }
                },
                required: ["routeIndex", "recommendedType", "riskLevel", "routeName", "safetyDetails"]
              }
            }
          },
          required: ["analysis"]
        }
      }
    });

    const text = response.text;
    if (!text) return routes;

    const safetyData = JSON.parse(text);

    return routes.map((route, index) => {
      const analysis = safetyData.analysis.find((a: any) => a.routeIndex === index);
      if (analysis) {
        // Keep the street-based name, append safety type
        const streetName = route.mainStreet || route.name;
        const safetyLabel = analysis.recommendedType === "SAFE" ? " (Safer)" : " (Alternative)";

        // Remove mainStreet from final output
        const { mainStreet, ...routeWithoutMainStreet } = route as RouteData & { mainStreet?: string };

        return {
          ...routeWithoutMainStreet,
          type: analysis.recommendedType,
          riskLevel: analysis.riskLevel,
          name: streetName.startsWith("Via ") ? streetName + safetyLabel : `Via ${streetName}${safetyLabel}`,
          safetyDetails: analysis.safetyDetails as SafetyDetails
        };
      }
      // Remove mainStreet from final output
      const { mainStreet, ...routeWithoutMainStreet } = route as RouteData & { mainStreet?: string };
      return routeWithoutMainStreet;
    });

  } catch (error) {
    console.error("Safety analysis error:", error);
    // Remove mainStreet from final output
    return routes.map(route => {
      const { mainStreet, ...routeWithoutMainStreet } = route as RouteData & { mainStreet?: string };
      return routeWithoutMainStreet;
    });
  }
}
