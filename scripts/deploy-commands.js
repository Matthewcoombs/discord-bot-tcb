const { readdirSync } = require('fs');
const { join } = require('path');
const { REST, Routes } = require('discord.js');
const { env, exit, cwd } = require('process');

// init env variables
require('dotenv').config();

const CLIENT_ID = env.CLIENT_ID;
const TOKEN = env.DISCORD_TOKEN;
const ENVIRONMENT = env.ENVIRONMENT;

const commands = [];
// Grab all the command files from the commands directory you created earlier
const foldersPath = join(cwd(), 'commands');
const commandFolders = readdirSync(foldersPath);

for (const folder of commandFolders) {
  // Grab all the command files from the commands directory you created earlier
  const commandsPath = join(foldersPath, folder);
  const commandFiles = readdirSync(commandsPath).filter((file) =>
    file.endsWith(ENVIRONMENT === 'development' ? '.ts' : '.js'),
  );
  // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
      );
    }
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(TOKEN);

// and deploy your commands!
(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`,
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commands,
    });

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`,
    );
    exit();
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
})();
