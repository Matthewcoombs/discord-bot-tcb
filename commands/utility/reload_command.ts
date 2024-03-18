import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder, SlashCommandStringOption } from "discord.js";
import { Command } from "../../shared/discord-js-types";

const reloadCommand: Command = {
	data: new SlashCommandBuilder()
		.setName('reload_command')
		.setDescription('Reloads a command.')
		.addStringOption((option: SlashCommandStringOption) =>
			option.setName('command_name')
				.setDescription('The command to reload.')
				.setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(interaction: ChatInputCommandInteraction) {
		const commandName = interaction.options.getString('command', true).toLowerCase();
		const command = interaction.client.commands.get(commandName) as Command;

		if (!command) {
			return interaction.reply({
                content: `There is no command with name \`${commandName}\`!`,
                ephemeral: true,
            });
		}

        // Locating the desired cached command file
        let commandFilePath;
        const cachedFilePaths = Object.keys(require.cache);
        for (const filePath of cachedFilePaths) {
            if (filePath.includes(`${commandName}.js`)) {
                commandFilePath = filePath;
                break;
            }
        }

        if (!commandFilePath) {
            return interaction.reply(
                {
                    content: `We could not find the command file!`,
                    ephemeral: true,
            });
        }

        delete require.cache[require.resolve(commandFilePath)];

        try {
            interaction.client.commands.delete(commandName);
            const newCommand = await require(commandFilePath);
            interaction.client.commands.set(commandName, newCommand);
            await interaction.reply({
                content: `Command \`${commandName}\` was reloaded!`,
                ephemeral: true,
            });
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: `There was an error while reloading a command \`${commandName}\`:\n\`${error}\``,
                ephemeral: true,
            });
        }
	},
};

export = reloadCommand;