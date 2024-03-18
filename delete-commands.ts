import { REST, Routes } from 'discord.js';
import * as process from 'process';

// init env variables
require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID as string;
const TOKEN = process.env.DISCORD_TOKEN as string;

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(TOKEN);
(async () => {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] })
	.then(() => console.log('Successfully deleted all application commands.'))
	.catch(console.error);

    process.exit();
})();