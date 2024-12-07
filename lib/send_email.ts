// pages/api/sendEmail.js
import nodemailer from 'nodemailer';
import dotenv from "dotenv"
dotenv.config()
export default async function send_email(email: { to: string; subject: string; text: string }) {
    const { to, subject, text } = email;

    

    if (!to || !subject || !text) {
        return "Please provide all fields"
    }

    try {
        // Configure your SMTP transporter
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com', // e.g., smtp.gmail.com
            port: 587, // or 465 for SSL
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL, // Your email address
                pass: process.env.PASS, // Your email password or app-specific password
            },
        });

        // Send the email
        const info = await transporter.sendMail({
            from: `"Better-Auth" <${process.env.EMAIL_USER}>`, // Sender address
            to, // Recipient address
            subject, // Subject line
            text, // Plain text body
            
            




            
            
        });

        return "Email sent successfully"
    } catch (error) {
        console.error('Error sending email:', error);
        return "An error occurred while sending the email"
    }
}
