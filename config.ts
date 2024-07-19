import { optInCommands, singleInstanceCommandsEnum } from "./shared/discord-js-types";

export enum imageModelEnums {
    DALLE2 = 'dall-e-2',
    DALLE3 = 'dall-e-3',
}

export enum textBasedModelEnums {
    GPT3 = 'gpt-3.5-turbo-0125',
    GPT4 = 'gpt-4-turbo-preview',
    GPT4O = 'gpt-4o',
    GPT40_MINI = 'gpt-4o-mini',
}

export const IMAGE_PROCESSING_MODELS = [textBasedModelEnums.GPT40_MINI, textBasedModelEnums.GPT4O];

export const config = {
    botId: '',
    openAi: {
        defaultChatCompletionModel: textBasedModelEnums.GPT40_MINI,
        defaultImageModel: imageModelEnums.DALLE2,
    },
    commands: {
        singleInstanceCommands: [
            singleInstanceCommandsEnum.LETS_CHAT,
            singleInstanceCommandsEnum.ASSISTANT,
        ],
        optInCommands: [
            optInCommands.CREATE_PROFILE,
            optInCommands.SELECT_PROFILE_SETTINGS,
        ]
    },
};