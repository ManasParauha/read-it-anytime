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
    const category = parsed.category;
    const summary = parsed.summary;

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
            content: `You are an expert content classifier and summarizer. Your task is to analyze the provided article or text, classify it into exactly one of the allowed categories, and generate a concise 2-3 sentence summary.

## Allowed Categories & Guidelines:
1. "Tech": Articles focusing on digital technologies, software, hardware, programming, artificial intelligence, the internet, cybersecurity, digital networks, consumer electronics, and the societal or developmental impact of digital technologies/advances.
2. "Business": Articles covering finance, economics, corporate affairs, startups, markets, trade, commerce, marketing, and business leadership.
3. "Science": Articles on physics, biology, chemistry, astronomy, space exploration, geology, climatology/environmental research, mathematics, and formal academic research discoveries.
4. "Health": Articles focusing on medicine, public health, healthcare policy, wellness, mental health, fitness, nutrition, diseases, and medical science.
5. "Politics": Articles about governments, elections, public policy, legislation, law, geopolitical relations, and civic issues.
6. "Culture": Articles discussing arts, literature, entertainment, music, cinema, history, sports, lifestyle, philosophy, and societal trends.
7. "Other": Content that does not clearly fit into any of the above categories (e.g., personal logs, recipes, announcements, or generic tutorials).

## Classification Rules:
- If a text overlaps across multiple categories (e.g., the policy or social impact of technology/digital advances), prefer the category that represents the primary subject (e.g., prioritize "Tech" if digital technology is the central theme).
- You must output exactly one of the allowed categories: "Tech", "Business", "Science", "Health", "Politics", "Culture", "Other". Do not use any other labels.

## Output Format:
You must return a raw, valid JSON object containing exactly these two keys:
{
  "category": "<One of the allowed categories>",
  "summary": "<A clear, concise, objective 2-3 sentence summary of the article content. Do not include any promotional or first-person language.>"
}

Do not wrap the JSON in markdown code blocks (e.g., do not use \`\`\`json) or include any other text outside of the JSON object.`
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
