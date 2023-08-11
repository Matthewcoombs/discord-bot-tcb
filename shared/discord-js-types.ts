import { ChatInputCommandInteraction, Client, CommandInteraction, GuildMember, Message, ModalSubmitInteraction, Presence, SlashCommandBuilder } from "discord.js";

export interface Command {
    name?: string;
    description?: string;
    once?: boolean;
    cooldown?: number;
    data?: Omit<SlashCommandBuilder, 'addSubcommandGroup' | 'addSubcommand'> ;
    execute(args?: 
        ChatInputCommandInteraction| 
        CommandInteraction | 
        Message | 
        Client | 
        GuildMember | 
        Presence | 
        ModalSubmitInteraction, 
        argsTwo?: Presence): any
}

export enum singleInstanceCommandsEnum {
    LETS_CHAT = 'lets_chat',
}

export enum optInCommands {
    CREATE_PROFILE = 'create_profile',
    DELETE_PROFILE = 'delete_profile'
}
