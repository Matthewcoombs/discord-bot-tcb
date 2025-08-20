<div align="center">
    <img src="https://cdn.discordapp.com/banners/1128001179671085189/71c88c3e628ee47f3b724eb12472b507.png?size=600" alt="Boop Banner Image">
</div>

# Boop - Discord Bot

A feature-rich Discord bot built with TypeScript and Discord.js, designed for small to private servers. Includes AI-powered generative features, utility commands, and fun interactions.

## ✨ Features

### 🤖 AI-Powered Commands

- **Image Generation** - Create images using OpenAI's DALL-E
- **Image Editing** - Edit existing images with AI
- **Image Variations** - Generate variations of uploaded images
- **Profile Management** - Create and manage AI conversation profiles

### 🛠️ Utility Commands

- **Bot Info** - Display available commands and bot information
- **Command Reload** - Hot-reload commands during development

### 🎉 Fun Commands

- **Ping** - Check bot responsiveness
- **Countdown** - Create interactive countdowns
- **And They Say** - Fun text responses

## 📋 Prerequisites

- [Discord Developer Account](https://discord.com/developers/docs/getting-started)
- [PostgreSQL Database](https://www.postgresql.org/docs/current/tutorial-install.html)
- [OpenAI API Account](https://platform.openai.com/docs/introduction)
- [Anthropic API Account](https://docs.anthropic.com/en/docs/intro-to-claude)
- Node.js 18+ and pnpm

## 🛠️ Local Development Setup

1. Clone the repository and install dependencies:

   ```bash
   pnpm install
   ```

2. Create a `.env` file with the following variables:

   ```env
   DISCORD_TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_application_id
   OPENAI_API_KEY=your_openai_api_key
   CLAUDE_API_KEY=your_anthropic_api_key
   POSTGRES_USERNAME=your_postgres_username
   POSTGRES_PASSWORD=your_postgres_password
   POSTGRES_DATABASE=your_database_name
   POSTGRES_HOSTNAME=your_postgres_host
   ```

3. Build and start the bot:
   ```bash
   pnpm build
   pnpm dev
   ```

## 🌐 Production Deployment

1. Set production environment variables
2. Build for production:
   ```bash
   pnpm build-prod
   ```
3. Start the bot using your preferred process manager

## 🔧 Command Management

- `pnpm update-commands` - Deploy/update slash commands
- `pnpm delete-commands` - Remove all slash commands
- `pnpm update-commands-dev` - Deploy commands in development
- `pnpm delete-commands-dev` - Remove commands in development

## 📁 Project Structure

```
├── commands/
│   ├── fun/           # Entertainment commands
│   ├── generative/    # AI-powered commands
│   └── utility/       # Bot utility commands
├── database/          # PostgreSQL connection and schemas
├── events/            # Discord.js event handlers
├── openAIClient/      # OpenAI integration
├── anthropicClient/   # Anthropic Claude integration
├── shared/            # Shared types and utilities
└── scripts/           # Deployment and management scripts
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm lint` to check code style
5. Submit a pull request
