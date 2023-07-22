import { ChatInputCommandInteraction, Client, CommandInteraction, GuildMember, Message, SlashCommandBuilder } from "discord.js";

export interface Command {
    name?: string;
    description?: string;
    once?: boolean;
    cooldown?: number;
    data?: Omit<SlashCommandBuilder, 'addSubcommandGroup' | 'addSubcommand'> ;
    execute(args?: ChatInputCommandInteraction| CommandInteraction | Message | Client | GuildMember): any
}