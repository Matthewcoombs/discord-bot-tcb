const { REST, Routes } = require('discord.js');
const { env, exit } = require('process');

// init env variables
require('dotenv').config();

const CLIENT_ID = env.CLIENT_ID;
const TOKEN = env.DISCORD_TOKEN;

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(TOKEN);
(async () => {
  await rest
    .put(Routes.applicationCommands(CLIENT_ID), { body: [] })
    .then(() => console.log(`Successfully deleted all application commands.`))
    .catch(console.error);

  exit();
})();
