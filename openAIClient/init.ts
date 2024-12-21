import OpenAI from 'openai';

function initOpenAI() {
  // creating config object to authenticate openai requests
  const openAI = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return openAI;
}

export { initOpenAI };
