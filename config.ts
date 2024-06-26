import { optInCommands, singleInstanceCommandsEnum } from "./shared/discord-js-types";

export enum imageModelEnums {
    DALLE2 = 'dall-e-2',
    DALLE3 = 'dall-e-3',
}

export enum textBasedModelEnums {
    GPT_DAVINCI = 'text-davinci-003',
    GPT3 = 'gpt-3.5-turbo-0125',
    GPT4 = 'gpt-4-turbo-preview',
    GPT4O = 'gpt-4o',
}

export const ASSISTANT_MODEL_OPTIONS = [ 
    textBasedModelEnums.GPT3, 
    textBasedModelEnums.GPT4,
    textBasedModelEnums.GPT4O,
];

export const config = {
    botId: '',
    openAi: {
        defaultCompletionModel: textBasedModelEnums.GPT_DAVINCI,
        defaultChatCompletionModel: textBasedModelEnums.GPT3,
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