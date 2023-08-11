import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Message } from "discord.js";
import { UserProfile } from "../../database/user_profiles/userProfilesDao";
import { ImagesResponse } from "openai";

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
    },

    generateImageEmbeds(generatedImages: ImagesResponse, username: string, description?: string) {
        const embeds = generatedImages.data.map(image => {
            const imageUrl = image?.url as string;
            return new EmbedBuilder()
                .setURL(imageUrl)
                .setImage(imageUrl);
        });

        const title = description ? `${username}'s image(s) of ${description}` : `${username}'s image(s)`;
    
        embeds[0].setTitle(title);
    
        return embeds;
    }
};