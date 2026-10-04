// Supabase Edge Function: process-audio
// Location: supabase/functions/process-audio/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestPayload {
  recordId: string;
}

// Background processing worker
async function processAudioRecord(recordId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  if (!openAiApiKey) {
    console.error("Missing OPENAI_API_KEY");
    // Update record to failed
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    await supabase
      .from("audio_files")
      .update({ status: "failed" })
      .eq("id", recordId);
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    console.log(`[process-audio] Starting processing for record: ${recordId}`);

    // 1. Fetch record from database
    const { data: record, error: fetchError } = await supabase
      .from("audio_files")
      .select("*")
      .eq("id", recordId)
      .single();

    if (fetchError || !record) {
      throw new Error(`Record not found: ${fetchError?.message || "Unknown error"}`);
    }

    // 2. Set status to "processing"
    await supabase
      .from("audio_files")
      .update({ status: "processing" })
      .eq("id", recordId);

    console.log(`[process-audio] Status updated to processing for: ${record.file_name}`);

    // 3. Download the audio file from Supabase Storage bucket 'audio-files'
    const { data: audioBlob, error: downloadError } = await supabase.storage
      .from("audio-files")
      .download(record.file_path);

    if (downloadError || !audioBlob) {
      throw new Error(`Failed to download audio from storage: ${downloadError?.message}`);
    }

    console.log(`[process-audio] Downloaded audio file (${audioBlob.size} bytes). Sending to Whisper STT...`);

    // 4. Send audio to OpenAI Speech-to-Text API (Whisper)
    const formData = new FormData();
    const fileName = record.file_name || "audio.mp3";
    formData.append("file", audioBlob, fileName);
    formData.append("model", "whisper-1");

    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      throw new Error(`OpenAI Whisper error (${whisperResponse.status}): ${errorText}`);
    }

    const whisperData = await whisperResponse.json();
    const transcriptText = (whisperData.text || "").trim();

    if (!transcriptText) {
      throw new Error("Transcribed audio yielded an empty transcript.");
    }

    console.log(`[process-audio] Transcription complete (${transcriptText.length} characters). Generating AI summary...`);

    // 5. Send transcript to OpenAI text model for structured summarization
    const summarizationPrompt = `You are an expert audio analyst and summarizer. You will receive the transcript of an audio recording (such as a meeting, conversation, interview, or mentorship discussion).

Analyze the transcript thoroughly and generate a concise, useful summary strictly based on what was said. Do NOT invent or assume any details not present in the transcript.

Format your output in clean Markdown with the following exact section headers:

## Overview
[A concise 2-4 sentence overview of the conversation/recording]

## Main Topics
- [Topic 1 with brief context]
- [Topic 2 with brief context]

## Key Points
- [Important point 1]
- [Important point 2]
- [Important point 3]

## Decisions & Conclusions
- [Decision or conclusion reached, or "None noted in the conversation" if none]

## Action Items
- [Concrete action item or next step with owner if specified, or "None specified" if none]

Transcript:
"""
${transcriptText}
"""`;

    const summaryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a precise, objective summarizer for spoken audio transcripts. Never invent facts. Return well-structured Markdown.",
          },
          {
            role: "user",
            content: summarizationPrompt,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!summaryResponse.ok) {
      const errorText = await summaryResponse.text();
      throw new Error(`OpenAI Summarization error (${summaryResponse.status}): ${errorText}`);
    }

    const summaryData = await summaryResponse.json();
    const summaryText = summaryData.choices?.[0]?.message?.content?.trim() || "";

    console.log(`[process-audio] Summary generated successfully. Saving to Supabase...`);

    // 6. Save transcript, summary, and completed status in Supabase
    const { error: updateError } = await supabase
      .from("audio_files")
      .update({
        transcript: transcriptText,
        summary: summaryText,
        status: "completed",
      })
      .eq("id", recordId);

    if (updateError) {
      throw new Error(`Failed to update database record with results: ${updateError.message}`);
    }

    console.log(`[process-audio] Processing successfully completed for record ${recordId}`);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[process-audio] Error during processing:`, errorMessage);

    // Update status to failed
    await supabase
      .from("audio_files")
      .update({
        status: "failed",
      })
      .eq("id", recordId);
  }
}

// Edge Function HTTP handler
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestPayload = await req.json();
    const { recordId } = body;

    if (!recordId) {
      return new Response(JSON.stringify({ error: "Missing required parameter: recordId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trigger background execution using EdgeRuntime.waitUntil so the client request
    // returns immediately and doesn't block the browser. The user can safely close the tab!
    // @ts-ignore EdgeRuntime is provided in Supabase Deno runtime
    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      // @ts-ignore EdgeRuntime
      EdgeRuntime.waitUntil(processAudioRecord(recordId));
    } else {
      // Fallback for non-EdgeRuntime environments
      processAudioRecord(recordId).catch((err) =>
        console.error("Background task unhandled error:", err)
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Processing started in background. You can safely close or navigate away.",
        recordId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
