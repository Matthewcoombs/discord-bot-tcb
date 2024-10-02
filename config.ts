import {
  optInCommands,
  singleInstanceCommandsEnum,
} from './shared/discord-js-types';

export enum imageModelEnums {
  DALLE2 = 'dall-e-2',
  DALLE3 = 'dall-e-3',
}

export enum textBasedModelEnums {
  GPT4O = 'gpt-4o',
  GPT40_MINI = 'gpt-4o-mini',
}

export enum chatToolsEnum {
  SEND_EMAIL = 'send_email',
}

export const IMAGE_PROCESSING_MODELS = [
  textBasedModelEnums.GPT40_MINI,
  textBasedModelEnums.GPT4O,
];

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
    ],
  },
  functionTools: [
    {
      type: 'function',
      function: {
        name: chatToolsEnum.SEND_EMAIL,
        strict: true,
        description:
          'Sends an email for the user. Call this whenever the user asks to send an email',
        parameters: {
          type: 'object',
          properties: {
            subject: {
              type: 'string',
              description: 'the subject of the email',
            },
            body: {
              type: 'string',
              description: 'the body of the email',
            },
            recipients: {
              type: 'array',
              items: {
                type: 'string',
              },
              description:
                'an array containing the email of all desired ricipients',
            },
          },
          required: ['subject', 'body', 'recipients'],
          additionalProperties: false,
        },
      },
    },
  ],
};
