import OpenAI from "openai";


function configureOpenAi() {
        // creating config object to authenticate openai requests
    const openAI = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    return openAI;
}

export {
    configureOpenAi
};