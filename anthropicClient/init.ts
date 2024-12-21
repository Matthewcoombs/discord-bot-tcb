import Anthropic from '@anthropic-ai/sdk';

function initAnthropicAI() {
  const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
  });

  return anthropic;
}

export { initAnthropicAI };
