<div align="center">
    <img src="https://cdn.discordapp.com/banners/1128001179671085189/3c533b6822dd2e711d5e30f19a2b110f?size=512" alt="Boop Banner Image">
</div>

# Discord Bot
This is a general discord bot project that is intended for use in small or private servers.
You are not required to have all configured services for the bot to run.
For information on bot configuration with discord see: https://discord.com/developers/docs/intro
For information on discordjs see: https://discordjs.guide/


## Pre Requisite
- DiscordJS Developer Account (https://discord.com/developers/docs/getting-started)
- PostGres Data Base
- https://www.postgresql.org/docs/current/tutorial-install.html
- OpenAI Developer Account (https://platform.openai.com/docs/introduction)


## Running Locally or Development
1. Generate a ***.env*** file and include the following variables:
    1. **DISCORD_TOKEN** - The token used by the discord bot to perform actions
    2. **CLIENT_ID** - The ID of the application your bot is tied to
    3. **OPENAI_API_KEY** - Your OpenAI Developer API Key
    4. **POSTGRES_USERNAME**
    5. **POSTGRES_PASSWORD**
    6. **POSTGRES_DATABASE**

2. Once everything is set we can run the following commands to launch our bot:
    1. `pnpm build`
    2. `pnpm dev`


## Running in Production
This project uses github actions for its CI/CD pipeline. You are free to update
this and use whatever CI/CD service you see fit.

The process is similar to running locally, so once the required production variables
are set run `pnpm build-prod`.

Starting the bot in production will be at the users discretion


## Deploying Commands
When you are adding new commands to the bot you can run the following commands:
`pnpm delete-commands` - Clear all existing commands
`pnpm update-commands` - Create/Update Commands