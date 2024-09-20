const OPENAI_API_URL = 'https://api.openai.com/v1';
const CHAT_MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-small";

export const validateApiKey = async (apiKey) => {
  try {
    const response = await fetch(`${OPENAI_API_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (response.ok) {
      const data = await response.json();
      console.log('Available models:', data.data);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error validating API key:', error);
    return false;
  }
};

export const sendQuestion = async (apiKey, prompt, context) => {
  try {
    const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: "You are a helpful assistant. Follow the instructions provided in the user's message." },
          { role: "user", content: prompt }
        ]
      })
    });
    if (response.ok) {
      const data = await response.json();
      return {
        answer: data.choices[0].message.content,
      };
    }
    throw new Error('Failed to get response from OpenAI');
  } catch (error) {
    console.error('Error sending question:', error);
    throw error;
  }
};

export const generateEmbeddings = async (apiKey, chunks, progressCallback, batchSize = 10) => {
  const embeddings = [];
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    
    try {
      const response = await fetch(`${OPENAI_API_URL}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: batch,
          model: EMBEDDING_MODEL
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        data.data.forEach(embedding => {
          embeddings.push(embedding.embedding);
        });
        
        // Call the progress callback
        if (progressCallback) {
          progressCallback(Math.min((i + batchSize) / chunks.length * 100, 100));
        }
      } else {
        throw new Error('Failed to generate embeddings');
      }
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }
  
  return embeddings;
};