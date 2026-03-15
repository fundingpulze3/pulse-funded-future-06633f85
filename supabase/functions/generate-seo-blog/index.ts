import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, primary_keyword, secondary_keywords, training_context } = await req.json();

    if (!topic || !primary_keyword) {
      return new Response(JSON.stringify({ error: "Topic and primary keyword are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trainingBlock = training_context
      ? `\n\nADDITIONAL TRAINING CONTEXT (use this to shape tone, style, and domain expertise):\n${training_context}`
      : "";

    const systemPrompt = `You are an elite SEO strategist, search intent analyst, and professional long-form content writer.
Your task is to generate a fully optimized SEO blog article designed to rank on Google for competitive keywords.
Follow modern SEO best practices: search intent optimization, semantic keyword usage, structured headings, readability, and engagement.
Write original content only. Focus on topical authority, semantic relevance, and readability. Avoid generic filler.${trainingBlock}`;

    const userPrompt = `Generate a complete SEO-optimized blog article with the following inputs:

**Topic:** ${topic}
**Primary Keyword:** ${primary_keyword}
**Secondary Keywords:** ${secondary_keywords || "None provided"}

Return a JSON object with EXACTLY these keys (no markdown fences, pure JSON):

{
  "seo_metadata": {
    "seo_title": "50-60 chars, includes primary keyword, high CTR",
    "meta_description": "150-160 chars, includes primary keyword, CTR optimized",
    "url_slug": "short, hyphen-separated, contains primary keyword"
  },
  "keyword_strategy": {
    "primary_keyword": "${primary_keyword}",
    "secondary_keywords": ["list of secondary keywords"],
    "lsi_keywords": ["10-20 semantically related keywords"],
    "search_intent": "informational|commercial|transactional|navigational"
  },
  "blog_content": "Full markdown blog post, 1500-2500 words. Include H1 title, introduction with hook, H2/H3 sections with SEO headings, bullet lists, examples, actionable insights. Integrate keywords naturally. Short paragraphs. Write for humans first.",
  "internal_linking_suggestions": ["3-5 internal link ideas based on topic"],
  "external_authority_sources": ["3 credible external references with URLs"],
  "faq_section": [
    {"question": "SEO optimized question targeting People Also Ask", "answer": "Concise helpful answer"}
  ],
  "featured_snippet": "40-60 word concise answer that could rank as Google featured snippet",
  "image_seo_suggestions": [
    {"title": "Image title", "alt_text": "Descriptive alt text", "caption": "Image caption", "file_name": "suggested-file-name.jpg"}
  ],
  "schema_markup_recommendations": ["Article", "FAQ", "etc"]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse the JSON from the AI response
    let parsed;
    try {
      // Try to extract JSON from potential markdown fences
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      // Return raw content if JSON parsing fails
      parsed = { raw_content: content, parse_error: true };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
