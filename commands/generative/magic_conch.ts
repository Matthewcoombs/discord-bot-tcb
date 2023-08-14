import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandStringOption } from "discord.js";
import { OpenAi } from "../..";
import { Command } from "../../shared/discord-js-types";
import { config } from "../../config";

const { completionModel } = config.openAi;



const aiSingleResponseCommand: Command = {
	data: new SlashCommandBuilder()
		.setName('magic_conch')
		.setDescription('Ask the all knowing magic conch shell')
		.addStringOption((option: SlashCommandStringOption) =>
			option.setName('question')
				.setDescription('What is your question?')
				.setRequired(true)),
	async execute(interaction: ChatInputCommandInteraction) {
        const username = interaction.user.username;
        await interaction.reply(`${username} asked me a question, so I'm thinking :thinking:...`);
        
		const question = interaction.options.getString('question', true).toLowerCase();

            await  OpenAi.createCompletion({
                model: completionModel,
                prompt: question,
                max_tokens: 4000
                }).then(async completion => {
                    const chatgptResponse = completion.data.choices[0].text;
                    await interaction.editReply(
                        `The question asked was - ${question}\n
                        My response is...
                        ${chatgptResponse}
                        hope that helps :blush:!
                        `);
                }).catch(async (err) => {
                    console.error(err);
                    await interaction.editReply(`Sorry ${username}, I've run into an issue attempting to answer your question.`);
                });

	},
};

export = aiSingleResponseCommand;