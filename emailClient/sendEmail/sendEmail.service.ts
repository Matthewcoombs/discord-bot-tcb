import Mail = require("nodemailer/lib/mailer")
import { EmailTransporter } from "../..";
import { EmailSendError } from "../../shared/errors";


export default {
    sendEmail(discordUser: string, recipients: string[], body: string, subject: string) {
        const emailOptions: Mail.Options = {
            from: process.env.EMAIL_ADDRESS,
            to: recipients.join(', '),
            subject,
            text: body,
        };
        
        EmailTransporter.sendMail(emailOptions, (error, info) => {
            if (error) {
                throw new EmailSendError({
                    error: `Error sending email`,
                    metaData: error,
                });
            } else {
                console.log(`Email sent for user ${discordUser}:`, info.response);
            }
        });
    }
};