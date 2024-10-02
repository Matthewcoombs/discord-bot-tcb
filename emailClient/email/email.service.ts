import Mail = require('nodemailer/lib/mailer');
import { EmailTransporter } from '../..';
import { EmailSendError } from '../../shared/errors';

export interface SendEmailArguments {
  subject: string;
  body: string;
  recipients: string[];
}

export default {
  sendEmail(discordUser: string, emailArgs: SendEmailArguments) {
    const emailOptions: Mail.Options = {
      from: process.env.EMAIL_ADDRESS,
      to: emailArgs.recipients.join(', '),
      subject: emailArgs.subject,
      text: emailArgs.body,
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
  },
};
