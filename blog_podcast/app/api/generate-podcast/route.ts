import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import path from 'path';
import fs from 'fs/promises';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';


function getValidatedGeminiApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || typeof key !== 'string' || key.trim() === '') {
    throw new Error('Missing or invalid Gemini API key. Please set GEMINI_API_KEY in your environment.');
  }
  return key;
}

function getValidatedTTSClient() {
  try {
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentials || credentials.trim() === '') {
      throw new Error('Missing Google Cloud credentials. Please set GOOGLE_APPLICATION_CREDENTIALS.');
    }
    return new TextToSpeechClient();
  } catch (err) {
    let msg = 'Google Cloud TTS authentication failed.';
    if (err && typeof err === 'object' && 'message' in err) {
      msg += ' ' + (err as any).message;
    }
    throw new Error(msg);
  }
}

function validateBlogUrl(blogUrl: string): string {
  try {
    const url = new URL(blogUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('URL must use http or https.');
    }
    // Optionally block private IPs (simple check)
    const hostname = url.hostname;
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)) {
      throw new Error('URL points to a private or local address.');
    }
    return url.toString();
  } catch (err) {
    let msg = 'Invalid blog URL.';
    if (err && typeof err === 'object' && 'message' in err) {
      msg += ' ' + (err as any).message;
    }
    throw new Error(msg);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { topics, blogUrl } = await req.json();

    let contentForPodcast = '';
    let generatedScript = '';


    let genAI: GoogleGenerativeAI;
    try {
      genAI = new GoogleGenerativeAI(getValidatedGeminiApiKey());
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    if (blogUrl) {
      try {
        const validatedUrl = validateBlogUrl(blogUrl);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
        let response;
        try {
          response = await fetch(validatedUrl, { signal: controller.signal });
        } catch (err: any) {
          if (err.name === 'AbortError') {
            throw new Error(`Fetch request to ${validatedUrl} timed out.`);
          }
          throw new Error(`Network error fetching ${validatedUrl}: ${err.message}`);
        } finally {
          clearTimeout(timeout);
        }
        if (!response.ok) {
          throw new Error(`Failed to fetch blog content from ${validatedUrl}: ${response.statusText}`);
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        let articleText = '';
        $('p, h1, h2, h3, h4, h5, h6, li').each((i, el) => {
          articleText += $(el).text() + '\n';
        });
        if (!articleText.trim()) {
          articleText = $('body').text();
        }
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `Summarize the following text into an eye-catching 80-word summary suitable for a podcast introduction:\n\n${articleText.substring(0, 8000)}`;
        const result = await model.generateContent(prompt);
        const responseText = await result.response;
        contentForPodcast = responseText.text();
        generatedScript = `Here's an eye-catching summary of the blog post:\n\n${contentForPodcast}\n\nFull podcast content would follow.`;
      } catch (fetchError: any) {
        console.error('Blog URL processing error:', fetchError);
        return NextResponse.json({ error: `Could not process blog URL: ${fetchError.message}` }, { status: 422 });
      }
    } else if (topics) {
      const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
      const prompt = `Generate a podcast script about the following topics: ${topics}. The script should be engaging and conversational, suitable for a 5-minute podcast.`;
      const result = await model.generateContent(prompt);
      const responseText = result.response;
      generatedScript = responseText.text();
      contentForPodcast = generatedScript;
    } else {
      return NextResponse.json({ error: 'No topics or blog URL provided.' }, { status: 400 });
    }

    // 2. Convert script/summary to speech using Google Cloud Text-to-Speech
    let ttsClient: TextToSpeechClient;
    try {
      ttsClient = getValidatedTTSClient();
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const [audioResponse] = await ttsClient.synthesizeSpeech({
      input: { text: contentForPodcast },
      voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
      audioConfig: { audioEncoding: 'MP3' },
    });
    if (!audioResponse.audioContent) {
      throw new Error('No audio content received from TTS service.');
    }

    // Generate a unique filename and save to public directory
    const filename = `podcast-${Date.now()}.mp3`;
    const publicDirPath = path.join(process.cwd(), 'public');
    const filePath = path.join(publicDirPath, filename);

    await fs.mkdir(publicDirPath, { recursive: true });
    await fs.writeFile(filePath, audioResponse.audioContent as Uint8Array);

    const audioUrl = `/${filename}`;

    return NextResponse.json({ script: generatedScript, audioUrl });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
