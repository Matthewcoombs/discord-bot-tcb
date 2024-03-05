import { optInCommands, singleInstanceCommandsEnum } from "./shared/discord-js-types";

export enum imageModelEnums {
    DALLE2 = 'dall-e-2',
    DALLE3 = 'dall-e-3',
}

export const config = {
    openAi: {
        completionModel: 'text-davinci-003',
        chatCompletionModel: 'gpt-3.5-turbo',
    },
    commands: {
        singleInstanceCommands: [
            singleInstanceCommandsEnum.LETS_CHAT,
            singleInstanceCommandsEnum.ASSISTANT,
        ],
        optInCommands: [
            optInCommands.CREATE_PROFILE,
        ]
    },
};