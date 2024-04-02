import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { ASSISTANT_MODEL_OPTIONS } from "../../config";
import { CHAT_TIMEOUT_OPTIONS, DEFAULT_CHAT_TIMEOUT } from "../../shared/constants";
import userProfilesDao, { UserProfile } from "../../database/user_profiles/userProfilesDao";
import { OpenAi } from "../..";

export const SELECT_TEXT_MODEL_ID = 'textModel';
export const SELECT_CHAT_TIMEOUT_ID = 'timeout';


export default {
    generateTextModelSelectionDisplay(selectedModel?: string) {
        const modelButtons: ButtonBuilder[] = [];
        for (let i = 0; i < ASSISTANT_MODEL_OPTIONS.length; i++) {
            const model = ASSISTANT_MODEL_OPTIONS[i];
            modelButtons.push(
                new ButtonBuilder()
                    .setCustomId(model)
                    .setLabel(model)
                    .setStyle(selectedModel === model ? ButtonStyle.Success : ButtonStyle.Primary)
            );
        }

        const row = new ActionRowBuilder()
            .addComponents(modelButtons);
        return { displayMsg: `Profile Model :wrench:`, row };
    },

    generateTextModelChatTimeout(selectedTimeout?: string) {
        const numSelectedTimeout = selectedTimeout ? Number(selectedTimeout) : DEFAULT_CHAT_TIMEOUT;
        const timeoutButtons: ButtonBuilder[] = [];
        for (let i = 0; i < CHAT_TIMEOUT_OPTIONS.length; i++) {
            const timeoutVal = CHAT_TIMEOUT_OPTIONS[i];
            timeoutButtons.push(
                new ButtonBuilder()
                    .setCustomId(timeoutVal.toString())
                    .setLabel(`${timeoutVal / 60000} minutes`)
                    .setStyle(timeoutVal === numSelectedTimeout ? ButtonStyle.Success : ButtonStyle.Primary)
            );
        }

        const row = new ActionRowBuilder()
            .addComponents(timeoutButtons);
        return { displayMsg: `Profile Chat Timeout :timer:`, row };
    },

    processSettingsDisplay(setting: string, selectedProfile: UserProfile) {
        switch (setting) {
            case SELECT_TEXT_MODEL_ID:
                return this.generateTextModelSelectionDisplay(selectedProfile.textModel);
            case SELECT_CHAT_TIMEOUT_ID:
                return this.generateTextModelChatTimeout(selectedProfile.timeout as string);
            default:
                break;
        }
    },

    async processUpdateUserProfile(setting: string, selectedProfile: UserProfile, updateValue: string) {
        switch (setting) {
            case SELECT_TEXT_MODEL_ID:
                selectedProfile.textModel = updateValue;
                await Promise.all([
                    userProfilesDao.updateUserProfile(selectedProfile),
                    OpenAi.beta.assistants.update(selectedProfile.assistantId, {
                        model: selectedProfile.textModel,
                    }),
                ]);
                break;
            case SELECT_CHAT_TIMEOUT_ID:
                selectedProfile.timeout = Number(updateValue);
                await userProfilesDao.updateUserProfile(selectedProfile);
                break;
            default:
                break;

        }
    }
};