export function generateWelcomeCopy(username: string) {
  return `Hello ${username}, welcome to the server!\n
I'll be your helpful assistant while you're here
To access my features please utilize the **/** to see a list of my various commands
For instance if you need an answer to a quick question you can use my **/magic_conch** command
If you want an image generated you can use **/generate_image** command
If you want to just chat you can use my **/lets_chat** command, or just talk to me here!\n
Have fun and enjoy your time here :blush:!`;
}

export function generateOptInCopy(username: string) {
  return `Hello ${username},\n
I would like your permission to track and record conversation data that we have.
For clarity your data will be used in the following way should you consent:\n
- Refinements in my logic to have more tailored and personal conversations.\n
- New features such as custom profiles and the ability to select my personality and expertise.\n
- Overall improvements to assist you quickly and in a manner that is more efficient!\n\n
If you would like to not have you data tracked and saved by me, you are free to opt out.`;
}

export function generateAssistantIntroCopy(profileName: string, username: string) {
  return `Hello ${username}\n
You have initiated the assistant service with your profile **${profileName}**.
To end this session simply say **goodbye**`;
}

export function generateAssistantRunKey(profileName: string) {
  return `go ${profileName}`.toLowerCase();
}
export const TEMP_FOLDER_PATH = `./temp`;
