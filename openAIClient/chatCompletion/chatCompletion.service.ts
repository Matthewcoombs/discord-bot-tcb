import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Message } from "discord.js";
import { UserProfile } from "../../database/user_profiles/userProfilesDao";

export interface ChatCompletionMessage {
    role: chatCompletionRoles;
    content: string;
}

enum chatCompletionRoles {
    SYSTEM = 'system',
    USER = 'user',
    ASSISTANT = 'assistant'
}

function generateSystemContentMessage(profile: string): ChatCompletionMessage {
    return {
        role: chatCompletionRoles.SYSTEM,
        content: profile,
    };
}

export default {
    formatChatCompletionMessages (messages: Message[], profile?: string): ChatCompletionMessage[] {
        const ChatCompletionMessages = messages.map(message => {
            if (message.author.bot) {
                return { role: chatCompletionRoles.ASSISTANT, content: message.content };
            } else {
                return { role: chatCompletionRoles.USER, content: message.content };
            }
        });

        if (profile) {
            ChatCompletionMessages.unshift(generateSystemContentMessage(profile));
        }
    
        return ChatCompletionMessages;
    },

    generateUserProfileDisplay(userProfiles: UserProfile[]) {
        const buttons = userProfiles.map(profile => {
            return new ButtonBuilder()
                .setCustomId(profile.id.toString())
                .setLabel(profile.name)
                .setStyle(ButtonStyle.Primary);
        });

        const row = new ActionRowBuilder()
            .addComponents(buttons);

        return row;
    }
};