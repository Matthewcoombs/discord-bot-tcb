import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Message } from "discord.js";
import { UserProfile } from "../../database/user_profiles/userProfilesDao";
import { ImagesResponse } from "openai/resources";
import axios from "axios";
import * as fs from 'fs';

import { GENERATIVE_RESPONSE_LIMIT_CONTEXT, TEMP_FOLDER_PATH } from "../../shared/constants";

export interface ChatCompletionMessage {
    role: chatCompletionRoles;
    content: string;
}

enum chatCompletionRoles {
    SYSTEM = 'system',
    USER = 'user',
    ASSISTANT = 'assistant',
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
        } else  {
            ChatCompletionMessages.unshift(generateSystemContentMessage(GENERATIVE_RESPONSE_LIMIT_CONTEXT));
        }
        return ChatCompletionMessages;
    },

    generateUserProfileDisplay(userProfiles: UserProfile[]) {
        const buttons = userProfiles.map(profile => {
            return new ButtonBuilder()
                .setCustomId(profile.id.toString())
                .setLabel(profile.name)
                .setStyle(profile.selected ? ButtonStyle.Success : ButtonStyle.Primary);
        });

        const row = new ActionRowBuilder()
            .addComponents(buttons);

        return row;
    },

    generateImageEmbeds(generatedImages: ImagesResponse, username: string) {
        const embeds = generatedImages.data.map(image => {
            const imageUrl = image?.url as string;
            return new EmbedBuilder()
                .setURL(imageUrl)
                .setImage(imageUrl);
        });

        const title = `${username}'s image(s)`;
    
        embeds[0].setTitle(title);
    
        return embeds;
    },

    async downloadAndConvertImagesToJpeg(imageUrls: string[], username: string, interactionTag: number) {
        for (let i = 0; i < imageUrls.length; i++) {
            const imageFilePath = `${TEMP_FOLDER_PATH}/${username}-${interactionTag}-${i+1}.jpeg`;
            await axios.get(imageUrls[i], {
                responseType: 'arraybuffer',
            }).then(response => {
                fs.writeFileSync(imageFilePath, response.data);
                console.log(`Image downloaded [image]: ${imageFilePath}`);
            }).catch(err => {
                console.error(`Error downloading image:`, err);
            });
        }
    }
};