# Ask Salam model configuration

The production voice pipeline uses three specialized model roles:

| Role | Default model | Configuration |
|---|---|---|
| Transcription and language detection | `gemini-3.5-flash-lite` | `GEMINI_TRANSCRIPTION_MODEL` |
| Operational reasoning and tool execution | `gpt-5.6-terra` | `OPENAI_MODEL` |
| Spoken response generation | `gpt-4o-mini-tts` | `OPENAI_TTS_MODEL` |

Set these Supabase secrets before deploying the voice functions:

```bash
supabase secrets set GEMINI_API_KEY=...
supabase secrets set OPENAI_API_KEY=sk-...
```

`assistant-transcribe` uses Gemini when `GEMINI_API_KEY` is configured. OpenAI
`gpt-4o-mini-transcribe` remains the automatic fallback and can be overridden
with `OPENAI_TRANSCRIPTION_MODEL`.

Deploy the affected functions:

```bash
supabase functions deploy assistant-turn
supabase functions deploy assistant-transcribe
supabase functions deploy assistant-speech
```
