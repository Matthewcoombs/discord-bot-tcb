import { InteractionError } from "./discord-js-types";

export const USER_TIMEOUT_CODE = `g-100`;


export const USER_RESPONSE_TIMEOUT = new InteractionError({
        code: USER_TIMEOUT_CODE,
        error: `Interaction timeout reached`,
});