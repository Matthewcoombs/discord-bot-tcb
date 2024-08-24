import * as nodemailer from 'nodemailer';

function configureEmailTransporter() {
    const transporter = nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false, 
        auth: {
            user: process.env.EMAIL_ADDRESS, 
            pass: process.env.EMAIL_PASSWORD, 
        },
    });

    return transporter;
}

export {
    configureEmailTransporter
};