import Mail = require("nodemailer/lib/mailer")
import { EmailTransporter } from "../..";


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
                console.error(`Error sending email:`, error);
            } else {
                console.log(`Email sent for user ${discordUser}:`, info.response);
            }
        });
    }
};