import { GoogleGenAI, Type } from "@google/genai";
import { ComplianceData } from "../types";

export const analyzeProductCompliance = async (
  base64Image: string,
  targetCountry: string,
  userQuery?: string
): Promise<ComplianceData> => {
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === "UNDEFINED") {
    throw new Error("Configuration Error: Global API Key missing. Please ensure your environment variables (PROCESS.ENV.API_KEY) are correctly configured in your deployment settings.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are an elite Global Trade Compliance Agent. 
    Target Market: ${targetCountry}
    Context Year: 2026
    
    Multimodal Input Analysis:
    - User Query: "${userQuery || 'N/A'}"
    - Image: [Product Image Provided]

    Phase 1: Identification & Localization
    - Detect the language of the user query.
    - IDENTIFY the product and its origin visually.
    - RESPOND in the detected language of the user query throughout the JSON values, except for specific technical codes.

    Phase 2: Real-Time Intelligence Probing (Use Google Search Grounding)
    - Currency Volatility Analysis: Search for 2026 forecasted volatility of ${targetCountry}'s currency against global benchmarks.
    - Active Trade Embargoes: Search for any current, newly enacted, or pending 2026 sanctions or export controls specifically affecting the identified product category and ${targetCountry}.
    - Recent Geopolitical Incidents: Scan for international trade disputes, supply chain blockades, or diplomatic incidents occurring in the last 6 months involving ${targetCountry}.
    - Regulatory Pulse: Find 2026 specific import/export laws and tariff changes for this product in ${targetCountry}.

    Phase 3: Deep Risk Assessment
    - Compute a "riskScore" (0-100) where 0 is perfectly safe and 100 is critical risk/embargoed.
    - Provide a granular "riskFactors" array identifying 3-4 specific real-time risks (Currency, Embargo, Incident, etc.).
    - Write a high-level "riskAnalysis" summarizing how these real-time search findings affected the score.

    Phase 4: Financial Modeling
    - Estimate Landing Cost: Assume a reasonable wholesale price, calculate shipping, and apply 2026 estimated tariffs.
    - Convert all costs to the local currency of ${targetCountry}.

    Phase 5: Cultural & Branding Nuance
    - Analyze packaging appropriateness for ${targetCountry}.

    Phase 6: Thought Signature
    - Provide 5-6 short steps describing your reasoning process.

    Return the result strictly as a JSON object matching this structure:
    {
      "productName": "...",
      "category": "...",
      "country": "${targetCountry}",
      "languageDetected": "...",
      "certifications": ["..."],
      "exportCertifications": ["..."],
      "riskScore": 75,
      "riskAnalysis": "...",
      "riskFactors": [
        { "factor": "Currency Stability", "impact": "High/Medium/Low", "description": "..." },
        { "factor": "Trade Restrictions", "impact": "High/Medium/Low", "description": "..." },
        { "factor": "Geopolitical Incidents", "impact": "High/Medium/Low", "description": "..." }
      ],
      "importRegulations": ["..."],
      "culturalCheck": {
        "status": "Compliant/Warning/Non-Compliant",
        "analysis": "...",
        "recommendations": ["..."]
      },
      "financials": {
        "basePriceEstimate": 0,
        "shippingEstimate": 0,
        "tariffRate": "...",
        "totalLandingCost": 0,
        "currency": "...",
        "exchangeRate": "..."
      },
      "shippingLabelRequirements": {
        "origin": "...",
        "weight": "...",
        "hsCode": "...",
        "warningLabels": ["..."]
      },
      "thoughtSignature": ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1],
            },
          },
          { text: prompt },
        ],
      },
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 4000 }
      },
    });

    if (!response || !response.text) {
      throw new Error("Intelligence Void: The model returned an empty payload.");
    }

    const jsonStr = response.text.replace(/```json|```/g, "").trim();
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error("Protocol Error: Strategic audit parsing failed.");
    }
    
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => ({
        title: chunk.web?.title || "Regulatory Source",
        uri: chunk.web?.uri || "#"
      })) || [];

    return {
      ...data,
      sources,
    };
  } catch (error: any) {
    const msg = error.message || "";
    throw new Error(msg || "Systemic Failure: An unknown error occurred within the intelligence pipeline.");
  }
};