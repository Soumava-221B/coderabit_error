"use client"

import { useState } from 'react';

export default function Home() {
  const [topics, setTopics] = useState('');
  const [blogUrl, setBlogUrl] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generatePodcast = async () => {
    setLoading(true);
    setError('');
    setGeneratedScript('');
    setAudioUrl('');

    try {
      const response = await fetch('/api/generate-podcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topics: topics, blogUrl: blogUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Something went wrong during podcast generation.');
      }

      const data = await response.json();
      setGeneratedScript(data.script);
      setAudioUrl(data.audioUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>AI Podcast Generator</h1>
      <textarea
        placeholder={"Enter topics or prompts for your podcast (e.g., \"The future of AI, quantum computing\")..."}
        value={topics}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTopics(e.target.value)}
        rows={5}
        cols={50}
      ></textarea>
      <p>OR</p>
      <input
        type="url"
        placeholder="Enter a blog post URL (e.g., https://example.com/blog-post)"
        value={blogUrl}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBlogUrl(e.target.value)}
        style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '5px', border: '1px solid #ddd' }}
      />
      <button onClick={generatePodcast} disabled={loading || (!topics.trim() && !blogUrl.trim())}>
        {loading ? 'Generating...' : 'Generate Podcast'}
      </button>

      {error && <p className="error-message">Error: {error}</p>}

      {generatedScript && (
        <div className="podcast-script">
          <h2>Generated Script:</h2>
          <pre>{generatedScript}</pre>
        </div>
      )}

      {audioUrl && (
        <div className="audio-player">
          <h2>Your Podcast:</h2>
          <audio controls src={audioUrl}>
            Your browser does not support the audio element.
          </audio>
          <a href={audioUrl} download="podcast.mp3">Download Podcast</a>
        </div>
      )}
    </div>
  );
}
