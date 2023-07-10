const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('reload')
		.setDescription('Reloads a command.')
		.addStringOption(option =>
			option.setName('command')
				.setDescription('The command to reload.')
				.setRequired(true)),
	async execute(interaction) {
		const commandName = interaction.options.getString('command', true).toLowerCase();
		const command = interaction.client.commands.get(commandName);

		if (!command) {
			return interaction.reply(`There is no command with name \`${commandName}\`!`);
		}

        // Locating the desired cached command file
        let commandFilePath;
        const cachedFilePaths = Object.keys(require.cache);
        for (const filePath of cachedFilePaths) {
            if (filePath.includes(`${command.data.name}.js`)) {
                commandFilePath = filePath;
                break;
            }
        }

        if (!commandFilePath) {
            return interaction.reply(`We could not find the command file!`);
        }

        delete require.cache[require.resolve(commandFilePath)];

        try {
            interaction.client.commands.delete(command.data.name);
            const newCommand = await require(commandFilePath);
            interaction.client.commands.set(newCommand.data.name, newCommand);
            await interaction.reply(`Command \`${newCommand.data.name}\` was reloaded!`);
        } catch (error) {
            console.error(error);
            await interaction.reply(`There was an error while reloading a command \`${command.data.name}\`:\n\`${error.message}\``);
        }
	},
};