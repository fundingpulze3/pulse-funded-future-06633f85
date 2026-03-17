import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, generateImage } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Image generation mode
    if (generateImage) {
      const imagePrompt = messages[messages.length - 1]?.content || "A professional blog header image";
      
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image-preview",
          messages: [{ role: "user", content: imagePrompt }],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("Image gen error:", response.status, t);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Image generation failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chat mode - streaming
    const systemPrompt = `You are BLOG AI — an elite SEO blog content specialist for Funding Pulze, a premier prop trading firm.

YOUR MISSION: Generate publication-ready Markdown blog content that scores 90+ on any SEO scoring tool.

RULES:
1. ALWAYS respond in full Markdown format with proper headings (H1, H2, H3), lists, bold, italics
2. ALWAYS include: engaging hook intro, structured H2/H3 sections, bullet/numbered lists, actionable insights, FAQ section, compelling conclusion with CTA
3. ALWAYS optimize for SEO: natural keyword placement, semantic keywords, short paragraphs (2-3 sentences max), transition words
4. Target 1500-2500 words for full articles
5. Use a professional yet approachable tone — authoritative but not stiff
6. Include internal linking suggestions as [LINK: topic] placeholders
7. When the user gives a rough idea, transform it into a complete, polished, SEO-optimized article
8. If asked for meta info, provide: SEO title (50-60 chars), meta description (150-160 chars), focus keyword, slug suggestion
9. Format code examples with triple backticks when relevant
10. Use tables when comparing data/features

FORMATTING EXCELLENCE:
- Start articles with a compelling H1 title
- Use H2 for main sections, H3 for subsections
- Bold key terms and important phrases
- Use > blockquotes for expert tips or key takeaways
- Add --- dividers between major sections
- Include emoji sparingly for engagement (1-2 per section max)

When the user says "generate image" or asks for an image, tell them to click the 🖼️ image button to generate blog images.

Current time: ${new Date().toISOString()}`;

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...(messages || []),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: allMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("blog-ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
