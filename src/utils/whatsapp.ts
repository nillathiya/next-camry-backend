import request from 'request-promise';
import dotenv from 'dotenv';
import nodemailer, { Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { findMany, findOne } from '../helpers/db';
import { AdminSettings } from '../models/adminSettings';
import { User } from '../models/user';

dotenv.config();

async function emailSettings() {
  try {
    // Fetch admin settings with title "E-Mail"
    const adminSettings = await findMany<AdminSettings>("adminSettings", { title: "E-Mail" });
    
    if (adminSettings.length > 0) {
      // Find entries by slug and get their value
      const senderEmail = adminSettings.find((setting) => setting.slug === "sender_email")?.value?.toString();
      const senderName = adminSettings.find((setting) => setting.slug === "sender_email_name")?.value?.toString();
      const senderPassword = adminSettings.find((setting) => setting.slug === "sender_email_password")?.value?.toString();
      const emailSmtpHost = adminSettings.find((setting) => setting.slug === "email_smtp_host")?.value?.toString();
      const smtpPort = 465;
      const emailSmtpSecure = true;

      // Return the settings for use in email sending
      return {
        senderEmail,
        senderName,
        senderPassword,
        emailSmtpHost,
        smtpPort,
        emailSmtpSecure,
      };
    } else {
      console.warn('No email settings found for title "E-Mail"');
      return null;
    }
  } catch (error) {
    console.error('Failed to fetch Email Settings:', error);
    return null; // Return null to avoid blocking background tasks
  }
}

export async function sendMessage(phoneNumber: string, msg: string, uCode = null): Promise<boolean> {
  console.log('sendMessage:', msg);
  const options = {
    method: 'POST',
    url: 'https://whatsline.io/api/create-message',
    formData: {
      appkey: process.env.WHATSLINE_APP_KEY,
      authkey: process.env.WHATSLINE_AUTH_KEY,
      to: phoneNumber,
      message: msg,
    },
  };

  try {
    // Send WhatsApp message in the background (unchanged)
    request(options).catch((error) => {
      console.error('Error sending WhatsApp message:', error);
    });

    // Send email in the background if uCode is provided
    if (uCode !== null) {
      const userData = await findOne<User>('users', { _id: uCode });
      if (userData && userData.email) {
        const toEmail = userData.email;
        // Fetch email settings and send email in the background
        emailSettings().then((settings) => {
          if (settings && settings.senderEmail && settings.emailSmtpHost && settings.senderPassword) {
            const transportOptions: SMTPTransport.Options = {
              host: settings.emailSmtpHost,
              port: settings.smtpPort,
              secure: settings.emailSmtpSecure,
              auth: {
                user: settings.senderEmail,
                pass: settings.senderPassword,
              },
            };

            const transporter: Transporter<SMTPTransport.SentMessageInfo> = nodemailer.createTransport(transportOptions);

            const mailOptions = {
              from: `"${settings.senderName || 'No-Reply'}" <${settings.senderEmail}>`,
              to: toEmail,
              subject: 'Message Notification',
              text: msg,
            };

            // Send email in the background and log errors without awaiting
            transporter.sendMail(mailOptions).catch((error) => {
              console.error('Error sending email:', error);
            });
          } else {
            console.error('Invalid or missing email settings');
          }
        }).catch((error) => {
          console.error('Error fetching email settings for email sending:', error);
        });
      } else {
        console.warn('No user found or missing email for uCode:', uCode);
      }
    }

    return true; // Return true immediately to fulfill the helper call
  } catch (error) {
    console.error('Error initiating WhatsApp message:', error);
    throw new Error('Failed to initiate WhatsApp message');
  }
}

export default { sendMessage };