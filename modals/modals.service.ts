import { ModalSubmitInteraction } from "discord.js";
import createProfileModal, { NEW_PROFILE_MODAL_ID } from "./generative/createProfileModal";


export default {
    async handleModalSubmit(modalInteraction: ModalSubmitInteraction) {
        const { customId } = modalInteraction;
        if (customId === NEW_PROFILE_MODAL_ID) {
            const response = await createProfileModal.handleNewProfileInput(modalInteraction);
            return response;
        }
    }
};