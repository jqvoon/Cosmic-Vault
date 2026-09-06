// Centralized API service layer for all remote calls.

const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const ANTHROPIC_VERSION = "2023-06-01";

function stripCodeBlockMarkers(rawText) {
  return rawText.replace(/```json|```/g, "").trim();
}

export async function generateAnthropicDescription({
  apiKey,
  fileName,
  category,
  fileSize,
}) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Anthropic API key is required.");
  }

  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `You are a smart file assistant. Given a filename and its category, generate metadata for a personal file storage app.\n\nFilename: "${fileName}"\nCategory: ${category}\nFile size: ${fileSize}\n\nReturn ONLY valid JSON (no markdown):\n{\n  "description": "1-2 sentence description."\n}`,
      },
    ],
  };

  const response = await fetch(ANTHROPIC_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(
      `Anthropic request failed: ${response.status} ${response.statusText}`,
    );
    err.details = text;
    throw err;
  }

  const data = await response.json();
  const textPayload =
    data.content?.find((chunk) => chunk.type === "text")?.text || "{}";
  const parsed = JSON.parse(stripCodeBlockMarkers(textPayload));
  return parsed;
}
