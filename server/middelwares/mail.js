const nodemailer = require('nodemailer');

const getEmailConfig = () => {
    const sender = process.env.EMAIL_SENDER || process.env.EMAIL_USERNAME || process.env.SMTP_USER || process.env.MAIL_USER || process.env.user;
    const password = process.env.EMAIL_SENDER_PASSWORD || process.env.EMAIL_PASSWORD || process.env.SMTP_PASS || process.env.MAIL_PASS || process.env.pass;
    const host = process.env.EMAIL_HOST || process.env.SMTP_HOST || (String(sender || '').includes('@gmail.com') ? 'smtp.gmail.com' : 'smtp.office365.com');
    const port = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || 587);
    const secure = String(process.env.EMAIL_SECURE || process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

    return {
        sender,
        password,
        host,
        port,
        secure,
        from: process.env.EMAIL_FROM || process.env.SMTP_FROM || sender,
    };
};

const sendEmail = async (to, subject, text, html) => {
    try {
        const config = getEmailConfig();
        if (!to) {
            console.warn('Email skipped: recipient is missing.');
            return null;
        }
        if (!config.sender || !config.password) {
            console.warn('Email skipped: sender email credentials are not configured.');
            return null;
        }

        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            connectionTimeout: Number(process.env.EMAIL_CONNECTION_TIMEOUT || 10000),
            greetingTimeout: Number(process.env.EMAIL_GREETING_TIMEOUT || 10000),
            socketTimeout: Number(process.env.EMAIL_SOCKET_TIMEOUT || 20000),
            auth: {
                user: config.sender,
                pass: config.password
            }
        });

        const mailOptions = {
            from: config.from,
            to: to,
            subject: subject,
            text: text,
            html: html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
        return info.response;
    } catch (error) {
        console.error('Failed to send email:', error);
        throw error;
    }
};


module.exports = { sendEmail }
