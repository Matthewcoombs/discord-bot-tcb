import { Message } from "discord.js";
import { OpenAi } from "../..";


export interface AssistantsMessage {
    role: AssistantsRoles;
    content: string;

}

enum AssistantsRoles {
    USER = 'user',
}

export enum runStatuses {
    QUEUED = "queued" , 
    IN_PROGRESS = "in_progress" , 
    REQUIRED_ACTION = "requires_action" , 
    CANCELLING = "cancelling" , 
    CANCELLED = "cancelled" , 
    FAILED = "failed" , 
    COMPLETED = "completed" , 
    EXPIRED = "expired"
}

export default {
    generateAssistantMessage (message: Message): AssistantsMessage {
        const assistantMessage: AssistantsMessage = {
            role: AssistantsRoles.USER,
            content: message.content,
        };
    
        return assistantMessage;
    },

    async getAssistantRunStatus(threadId: string, runId: string): Promise<runStatuses> {
        const { status } = await OpenAi.beta.threads.runs.retrieve(
            threadId,
            runId,
        );

        return status as runStatuses;
    },

    // async monitorAssistantRun(threadId: string, runId: string): Promise<string> {
    //     let runStatus: runStatuses;
    //     const intervalId = setInterval(async () => {
    //         const status = await this.getAssistantRunStatus(threadId, runId);
    //         if (status === runStatuses.COMPLETED) {
    //             runStatus = status;
    //             clearInterval(intervalId);
    //             return runStatus;

    //         }
    //     }, 2000);
    // }
};