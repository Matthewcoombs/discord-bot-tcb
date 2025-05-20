<div align="center">
    <img src="
    https://cdn.discordapp.com/banners/1128001179671085189/71c88c3e628ee47f3b724eb12472b507.png?size=600" alt="Boop Banner Image">
</div>

# Boop - Discord Bot

This is a general discord bot project that is intended for use in small or private servers.
You are not required to have all configured services for the bot to run.
For information on bot configuration with discord see: https://discord.com/developers/docs/intro
For information on discordjs see: https://discordjs.guide/

## 📋 Prerequisites

- [DiscordJS Developer Account](https://discord.com/developers/docs/getting-started)
- [PostGres Data Base](https://www.postgresql.org/docs/current/tutorial-install.html)
- [OpenAI Developer Account](https://platform.openai.com/docs/introduction)
- [Anthropic Developer Account](https://docs.anthropic.com/en/docs/intro-to-claude)

## 🛠️ Local Development Setup

1. Generate a **_.env_** file and include the following variables:

   - **DISCORD_TOKEN** - The token used by the discord bot to perform actions
   - **CLIENT_ID** - The ID of the application your bot is tied to
   - **OPENAI_API_KEY** - Your OpenAI API key
   - **CLAUDE_API_KEY** - Your Anthropic API key
   - **POSTGRES_USERNAME**
   - **POSTGRES_PASSWORD**
   - **POSTGRES_DATABASE**
   - **POSTGRES_HOSTNAME**

2. Once everything is set we can run the following commands to launch the bot in a development environment:
   1. `pnpm build`
   2. `pnpm dev`

## 🌐 Production Deployment

This project uses github actions for its CI/CD pipeline. You are free to update
this and use whatever CI/CD service you see fit.

The process is similar to running locally, so once the required production variables
are set run `pnpm build-prod`.

Starting the bot in production will be at the users discretion

## 🔧 Command Management

When you are adding new commands to the bot you can run the following commands:
`pnpm delete-commands` - Clear all existing commands
`pnpm update-commands` - Create/Update Commands

**Note:** Modify deployment process as per your infrastructure requirements.
