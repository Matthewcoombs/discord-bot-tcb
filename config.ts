import { optInCommands, singleInstanceCommandsEnum } from "./shared/discord-js-types";

export const config = {
    openAi: {
        completionModel: 'text-davinci-003',
        chatCompletionModel: 'gpt-3.5-turbo',
    },
    commands: {
        singleInstanceCommands: [
            singleInstanceCommandsEnum.LETS_CHAT,
        ],
        optInCommands: [
            optInCommands.CREATE_PROFILE,
        ]
    },
};