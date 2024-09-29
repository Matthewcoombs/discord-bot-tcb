import { ChannelType, ChatInputCommandInteraction, Client, CommandInteraction, GuildMember, Message, ModalSubmitInteraction, Presence, SlashCommandOptionsOnlyBuilder } from "discord.js";
import { UserProfile } from "../database/user_profiles/userProfilesDao";

export interface Command {
    name?: string;
    description?: string;
    once?: boolean;
    cooldown?: number;
    data?: Omit<SlashCommandOptionsOnlyBuilder, 'addSubcommandGroup' | 'addSubcommand'> ;
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

export interface SingleInstanceCommand {
    channelType: ChannelType | undefined;
    channelId: string | undefined;
    channelName: string | null;
    name: string;
    user:string;
    userId: string;
}

export interface ChatInstance {
    userId: string;
    selectedProfile: UserProfile;
    isProcessing: boolean;
    channelName: string | undefined; 
    channelId: string;
}

export enum singleInstanceCommandsEnum {
    LETS_CHAT = 'lets_chat',
    ASSISTANT = 'assistant',
}

export enum optInCommands {
    CREATE_PROFILE = 'create_profile',
    DELETE_PROFILE = 'delete_profile',
    UPDATE_PROFILE = 'update_profile',
    SELECT_PROFILE = 'select_profile',
    SELECT_PROFILE_SETTINGS = 'select_profile_settings'
}
