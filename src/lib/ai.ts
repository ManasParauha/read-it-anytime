export const ALLOWED_CATEGORIES = ['Tech', 'Business', 'Science', 'Health', 'Politics', 'Culture', 'Other'] as const;

export type AICategory = typeof ALLOWED_CATEGORIES[number];

export interface AIResult {
  category: AICategory;
  summary: string;
}

/**
 * Generates a clean fallback summary by truncating and cleaning up the source text.
 */
export function getFallbackSummary(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 200) return clean;
  return clean.substring(0, 197) + '...';
}

/**
 * Clean markdown code blocks/fences and parse the JSON string defensively.
 */
function cleanAndParseResponse(rawResponse: string, fallbackSummary: string): AIResult {
  let cleaned = rawResponse.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?\s*/i, '').replace(/\s*```$/, '');
  }
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);
    let category = parsed.category;
    let summary = parsed.summary;

    let finalCategory: AICategory = 'Other';
    if (typeof category === 'string') {
      const normalized = category.trim();
      const matched = ALLOWED_CATEGORIES.find(
        (c) => c.toLowerCase() === normalized.toLowerCase()
      );
      if (matched) {
        finalCategory = matched;
      }
    }

    let finalSummary = fallbackSummary;
    if (typeof summary === 'string' && summary.trim().length > 0) {
      finalSummary = summary.trim();
    }

    return {
      category: finalCategory,
      summary: finalSummary,
    };
  } catch (error) {
    console.error('[AI] Parsing failed:', error, 'Raw response was:', rawResponse);
    return {
      category: 'Other',
      summary: fallbackSummary,
    };
  }
}

/**
 * Calls the AI provider to categorize and summarize the text.
 * Built on Groq's OpenAI-compatible completions endpoint.
 * Implements logging for cost/character count, strict JSON format,
 * defensive parsing, and a 15-second abort timeout.
 */
export async function categorizeAndSummarize(text: string): Promise<AIResult> {
  const fallbackSummary = getFallbackSummary(text);
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    console.warn('[AI] WARNING: AI_API_KEY environment variable is not set. Using fallback values.');
    return {
      category: 'Other',
      summary: fallbackSummary,
    };
  }

  // Cost safety/visibility: log characters sent
  console.log(`[AI] Calling API with text length: ${text.length} characters.`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant that analyzes article text. You must return a strict JSON object with two fields:
"category": must be exactly one of: "Tech", "Business", "Science", "Health", "Politics", "Culture", "Other".
"summary": a 2-3 sentence summary of the article.

Do not wrap in any extra markdown or text outside the JSON object. Return JSON only.`
          },
          {
            role: 'user',
            content: text,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[AI] API call failed with status ${response.status}: ${response.statusText}`);
      return {
        category: 'Other',
        summary: fallbackSummary,
      };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[AI] Empty message content in API response');
      return {
        category: 'Other',
        summary: fallbackSummary,
      };
    }

    return cleanAndParseResponse(content, fallbackSummary);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('[AI] Request timed out after 15 seconds.');
    } else {
      console.error('[AI] Request failed:', error);
    }
    return {
      category: 'Other',
      summary: fallbackSummary,
    };
  }
}
