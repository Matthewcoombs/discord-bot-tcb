export function generateWelcomeCopy(username: string) {
   return `Hello ${username}, welcome to the server!\n
I'll be your helpful assistant while you're here.\n
To access my features please utilize the **/** to see a list of my various commands.\n
For instance if you need an answer to a quick question you can use my **/magic_conch** command.\n
If you want an image generated you can use **/generate_image** command.\n
If you want to just chat you can use my **/lets_chat** command.\n
Have fun and enjoy your time here :blush:!`;
}

export function generateOptInCopy(username: string) {
   return `Hello ${username},\n
My creator would like to ask for your permission to track and record conversation data that we have.
This data will be used in the following way:\n
- Refinements in my logic to have more tailored and personal conversations.\n
- New features such as custom profiles and the ability to select my personality and expertise.\n
- Overall improvements to assist you quickly and in a manner that is more efficient!\n\n
If you would like to not have you data tracked and saved by me, you can opt out :blush:.`;
}

export function generateAssistantIntroCopy(profileName: string, username: string) {
   return `Hello ${username}\n
I'm your assistant ${profileName}. Simply enter instructions for me in the chat
and when you're ready for me to proceed enter the phrase: "**${generateAssistantRunKey(profileName)}**".
To end this session simply say "**goodbye**"`;
}

export function generateAssistantRunKey(profileName: string) {
   return `go ${profileName}`.toLowerCase();
}

export const PROFILE_PLACEHOLDER_TEXT = `You're name is {name}. Your favorite color is {color}, you're
extremely good at...`;
export const GENERATIVE_RESPONSE_LIMIT_CONTEXT = `\nNOTE - ensure that your response does not exceed 2000 characters in length.`;
export const GENERAL_CHANNEL = 'general';
export const CHAT_GPT_CHAT_TIMEOUT = 300000;
export const PROFILES_LIMIT = 4;
// Setting 4mb image size limit
export const IMAGE_TOUCH_UP_SIZE_LIMIT = 4000000;
export const TEMP_FOLDER_PATH = `./temp`;
export const DISCORD_MAX_REPLY_STRING_LENGTH = 2000;
export const MAX_MESSAGE_COLLECTORS = 4;
export const MAX_USER_SINGLE_INSTANCE_COMMANDS = 4;