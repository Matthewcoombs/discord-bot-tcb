import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { ASSISTANT_MODEL_OPTIONS } from "../../config";
import { CHAT_TIMEOUT_OPTIONS, DEFAULT_CHAT_TIMEOUT, DEFAULT_RETENTION_SIZE, RETENTION_SIZE_OPTIONS } from "../../shared/constants";
import userProfilesDao, { UserProfile } from "../../database/user_profiles/userProfilesDao";
import { OpenAi } from "../..";

export const SELECT_TEXT_MODEL_ID = 'textModel';
export const SELECT_CHAT_TIMEOUT_ID = 'timeout';
export const SELECT_RETENTION_ID = 'retention';
export const SELECT_RETENTION_SIZE_ID = 'retentionSize';


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

    generateRetentionProfileSetting(retentionSetting?: boolean) {
        const retention = retentionSetting ? retentionSetting : false;
        const retentionButtons: ButtonBuilder[] = [];
        const retentionOptions = [true, false];
        for (let i = 0; i < retentionOptions.length; i++) {
            const optVal = retentionOptions[i];
            retentionButtons.push(
                new ButtonBuilder()
                    .setCustomId(optVal.toString())
                    .setLabel(optVal.toString())
                    .setStyle(optVal === retention ? ButtonStyle.Success : ButtonStyle.Primary)
            );
        }

        const row  = new ActionRowBuilder()
            .addComponents(retentionButtons);
        return { displayMsg: `Profile Retention :brain:`, row };
    },

    generateRetentionSizeProfileSetting(retentionSizeSetting?: number) {
        const retentionSize = retentionSizeSetting ? retentionSizeSetting : DEFAULT_RETENTION_SIZE;
        const retentionSizeButtons: ButtonBuilder[] = [];
        for (let i = 0; i < RETENTION_SIZE_OPTIONS.length; i++) {
            const optVal = RETENTION_SIZE_OPTIONS[i];
            retentionSizeButtons.push(
                new ButtonBuilder()
                    .setCustomId(optVal.toString())
                    .setLabel(optVal.toString())
                    .setStyle(optVal === retentionSize ? ButtonStyle.Success : ButtonStyle.Primary)
            );
        }

        const row = new ActionRowBuilder()
            .addComponents(retentionSizeButtons);
        return { displayMsg: `Profile Retention Size :ledger:`, row };
    },

    processSettingsDisplay(setting: string, selectedProfile: UserProfile) {
        switch (setting) {
            case SELECT_TEXT_MODEL_ID:
                return this.generateTextModelSelectionDisplay(selectedProfile.textModel);
            case SELECT_CHAT_TIMEOUT_ID:
                return this.generateTextModelChatTimeout(selectedProfile.timeout as string);
            case SELECT_RETENTION_ID:
                return this.generateRetentionProfileSetting(selectedProfile.retention);
            case SELECT_RETENTION_SIZE_ID:
                return this.generateRetentionSizeProfileSetting(selectedProfile.retentionSize as number);
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
            case SELECT_RETENTION_ID:
                selectedProfile.retention = updateValue === 'true';
                await userProfilesDao.updateUserProfile(selectedProfile);
                break;
            case SELECT_RETENTION_SIZE_ID:
                selectedProfile.retentionSize = Number(updateValue);
                await userProfilesDao.updateUserProfile(selectedProfile);
                break;
            default:
                break;

        }
    }
};