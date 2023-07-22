import { Configuration, OpenAIApi } from "openai";

function configureOpenAi() {
        // creating config object to authenticate openai requests
    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });

    return new OpenAIApi(configuration);
}

export {
    configureOpenAi
}