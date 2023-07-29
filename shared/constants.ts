export function generateWelcomeCopy(username: string) {
   return `Hello ${username}, welcome to the server!\n
I'll be your helpful assistant while you're here.\n
To access my features please utilize the **/** to see a list of my various commands.\n
For instance if you need an answer to a quick question you can use my **/magic_conch** command.\n
If you want an image generated you can use **/magic_conch_image** command.\n
If you want to just chat you can use my **/lets_chat** command.\n
Have fun and enjoy your time here :blush:!`;
}

export function generateOptInCopy(username: string) {
   return `Hello ${username},\n
My creator would like to ask for your permission to track and record conversation data that we have.
This data will be used in the following way:\n
- Refinements in my logic to have more tailored and personal conversations.\n
- New features such as custom profiles and the ability to select my personality and expertise.\n
- Overall improvements to assist you quickly and in a manner that improved efficiency!\n\n
If you would like to not have you data tracked and saved by me, you can opt out :blush:.`;
}

export const GENERAL_CHANNEL = 'general';
export const CHAT_GPT_CHAT_TIMEOUT = 180000;
