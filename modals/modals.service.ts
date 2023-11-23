import { ModalSubmitInteraction } from "discord.js";
import profileModal, { NEW_PROFILE_MODAL_ID, UPDATE_PROFILE_MODAL_ID } from "./generative/profileModal";


export default {
    async handleModalSubmit(modalInteraction: ModalSubmitInteraction) {
        const { customId } = modalInteraction;
        if (customId === NEW_PROFILE_MODAL_ID) {
            const response = await profileModal.handleNewProfileInput(modalInteraction);
            return response;
        }
        if (customId === UPDATE_PROFILE_MODAL_ID) {
            const response = await profileModal.handleUpdateModalInput(modalInteraction);
            return response;
        }
    }
};