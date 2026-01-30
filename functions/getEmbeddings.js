/**
 * createAndPrintEmbeddings(input)
 * - input: string or JSON-serializable object
 * - reads OPENAI_API_KEY from process.env (use a .env file)
 * - creates an embedding via OpenAI Embeddings API and prints results
 */
async function createAndPrintEmbeddings(input) {
  // Get API key from environment variables
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set. Please set it in your .env file.');
    return;
  }

  let text;
  if (typeof input === 'string') {
    text = input;
  } else if (typeof input === 'object' && input !== null) {
    try {
      text = JSON.stringify(input);
    } catch (err) {
      console.error('Failed to stringify JSON input:', err);
      return;
    }
  } else {
    console.error('Unsupported input type. Provide a string or a JSON object.');
    return;
  }

  // Use global fetch (Node 18+) or try to require node-fetch as a fallback
  let fetchFn = global.fetch;
  if (!fetchFn) {
    try {
      // node-fetch v2/v3 may require different import styles; this works in many CommonJS setups
      // If this fails, please install a compatible fetch (e.g. `npm install node-fetch@2`) or run on Node 18+
      fetchFn = require('node-fetch');
    } catch (e) {
      console.error('No fetch available. Use Node 18+ or install node-fetch.');
      return;
    }
  }

  const url = 'https://api.openai.com/v1/embeddings';
  const body = { model: 'text-embedding-3-small', input: text };

  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('OpenAI API returned an error:', res.status, errText);
      return;
    }

    const data = await res.json();

    // Print a concise summary and the full response
    console.log('--- Embedding generation result ---');
    console.log('Input (original):', typeof input === 'string' ? input : JSON.stringify(input));
    console.log('Model:', data.model || 'unknown');

    if (Array.isArray(data.data) && data.data.length > 0) {
      const embed = data.data[0].embedding;
      console.log('Embedding length:', embed.length);
      console.log('Embedding (first 10 dims):', embed.slice(0, 10));
    }

    console.log('Full response:');
    console.log(JSON.stringify(data, null, 2));

    return data;
  } catch (err) {
    console.error('Request failed:', err);
  }
}

// Small main() to test embeddings creation with a sample company JSON
async function main() {
  const sampleCompany = {
    name: 'Acme Corp',
    industry: 'Technology',
    founded: 2008,
    employees: 124,
    headquarters: 'San Francisco, CA',
    description: 'Acme builds developer tools to accelerate ML workflows and help teams ship models faster.',
    products: [
      { name: 'AcmeStudio', category: 'ML Platform', launched: 2019 },
      { name: 'AcmeDocs', category: 'Knowledge Base', launched: 2021 }
    ],
    financials: { currency: 'USD', revenue_last_year: '12M', yoy_growth: '35%' },
    contacts: { website: 'https://acme.example.com', linkedin: 'https://linkedin.com/company/acme-corp', email: 'info@acme.example.com' }
  };

  return createAndPrintEmbeddings(sampleCompany);
}

// If executed directly, run the sample main() to print embeddings
if (require.main === module) {
  main().catch(err => {
    console.error('Error running main():', err);
    process.exit(1);
  });
}

// Export only the simple embedding helper (no CLI or demo)
module.exports = { createAndPrintEmbeddings, main };