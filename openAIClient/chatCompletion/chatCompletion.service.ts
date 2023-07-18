import { Message } from "discord.js";

export interface ChatCompletionMessage {
    role: chatCompletionRoles;
    content: string;
}

enum chatCompletionRoles {
    SYSTEM = 'system',
    USER = 'user',
    ASSISTANT = 'assistant'
}


function formatChatCompletionMessages (messages: Message[]): ChatCompletionMessage[] {
    const ChatCompletionMessages = messages.map(message => {
        if (message.author.bot) {
            return { role: chatCompletionRoles.ASSISTANT, content: message.content };
        } else {
            return { role: chatCompletionRoles.USER, content: message.content };
        }
    });

    return ChatCompletionMessages;
}

export {
    formatChatCompletionMessages,
}