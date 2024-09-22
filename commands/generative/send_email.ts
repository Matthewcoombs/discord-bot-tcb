import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../shared/discord-js-types";
import { generateInteractionTag } from "../../shared/utils";
import sendEmailService from "../../emailClient/sendEmail/sendEmail.service";


const sendEmailCommand: Command = {
    data: new SlashCommandBuilder()
    .setName('send_email')
    .setDescription('Send email(s)')
    .addStringOption(strOption => 
        strOption.setName('recipients')
        .setDescription('Comma-seperated list of email recipients')
        .setRequired(true)
    )
    .addStringOption(strOption => 
        strOption.setName('subject')
        .setDescription(`The email's subject`)
        .setRequired(true)
    )
    .addStringOption(strOption =>
        strOption.setName('body')
        .setDescription('The body of the email')
        .setRequired(true)
    ),
    execute(interaction: ChatInputCommandInteraction) {
        const interationTag = generateInteractionTag();
        const { username } = interaction.user;
        const invalidEmails: string[] = [];

        const recipients = interaction.options.getString('recipients', true);
        const recipientsArray = recipients.split(',').map((email) => {
            const trimmedEmail = email.trim();
            const emailRegex = /^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(trimmedEmail)) {
                invalidEmails.push(trimmedEmail);
            }
            return email;
        }
        );

        if (invalidEmails.length > 0) {
            return interaction.reply({
                content: `Sorry but the email(s) provided are invalid - [emails]:${invalidEmails}`,
                ephemeral: true
            });
        }

        const subject = interaction.options.getString('subject', true);
        const body = interaction.options.getString('body', true);

        try {
            sendEmailService.sendEmail(username, recipientsArray, body, subject);
            return interaction.reply({
                content: `:incoming_envelope: your email has been sent`,
                ephemeral: true,
            });
        } catch {
            console.error(`There was an error attempting to send the email - [interactionTag]: ${interationTag}`);
            return interaction.reply({
                content: `There was an error sending the email(s)`,
                ephemeral: true,
            });
        }


    }
};

export = sendEmailCommand;