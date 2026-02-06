
import { GoogleGenAI, Type } from "@google/genai";
import { TransformationResult } from "../types.ts";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function transformSketchToCode(imageBase64: string): Promise<TransformationResult> {
  const model = 'gemini-3-flash-preview';
  
  const systemInstruction = `
    You are CodeCanvas AI - an elite software architect and frontend specialist. You transform UI sketches into high-fidelity, production-ready React applications.
    
    ENGINE PHILOSOPHY:
    1. Modern Aesthetics: Use sophisticated Tailwind palettes (slate, indigo, violet, rose). Implement glassmorphism, subtle gradients, and high-quality shadows.
    2. Interactive Fidelity: All generated buttons, inputs, and nav items MUST have interactive states (hover, focus, active).
    3. Structural Precision: Use Flexbox and CSS Grid for robust, responsive layouts.
    4. Iconography: Use Lucide React icons via CDN (https://unpkg.com/lucide@latest).
    
    TECHNICAL CONSTRAINTS:
    - Single standalone HTML file.
    - React 18 & ReactDOM 18 UMD versions.
    - Tailwind CSS 3.x CDN.
    - NO external dependencies other than React, ReactDOM, Tailwind, and Lucide.
    - Use React.createElement (JSX is NOT supported in this environment).
    
    CODE STRUCTURE:
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <script src="https://cdn.tailwindcss.com"></script>
      <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
      <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
      <script src="https://unpkg.com/lucide@latest"></script>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(10px); }
      </style>
    </head>
    <body class="bg-slate-50 text-slate-900">
      <div id="root"></div>
      <script>
        const React = window.React;
        const ReactDOM = window.ReactDOM;
        const { useState, useEffect, createElement: ce } = React;
        
        function App() {
          // Robust application logic here
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(ce(App));
      </script>
    </body>
    </html>
  `;

  const prompt = `
    Analyze this UI sketch. Identify every component: buttons, inputs, charts, cards, navbars, and sidebars.
    
    GENERATE:
    1. Detailed analysis of UI intent.
    2. A complete, fully functional React application that looks like a modern SaaS or mobile app based on the sketch.
    3. Add "Realistic" touches: placeholder data, smooth transitions, and responsive behavior.
    
    IMPORTANT: The output MUST be valid JSON. The "htmlCode" property MUST be a multi-line string.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/png', data: imageBase64 } },
        { text: prompt }
      ]
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          analysis: {
            type: Type.OBJECT,
            properties: {
              uiType: { type: Type.STRING },
              components: { type: Type.ARRAY, items: { type: Type.STRING } },
              layout: { type: Type.STRING },
              colors: { type: Type.STRING }
            },
            required: ["uiType", "components", "layout", "colors"]
          },
          htmlCode: { type: Type.STRING }
        },
        required: ["analysis", "htmlCode"]
      }
    }
  });

  const resultText = response.text;
  if (!resultText) throw new Error("Synthesis failed: Empty response from engine.");
  
  try {
    return JSON.parse(resultText) as TransformationResult;
  } catch (e) {
    throw new Error("Synthesis failed: Invalid response format from engine.");
  }
}
