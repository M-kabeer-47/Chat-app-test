import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import  send_email  from './send_email'
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle"; 
import {user,account,session,verification,twoFactor} from "../db/auth-schema"
import { twoFactor as two_factor_plugin } from "better-auth/plugins"
dotenv.config();

const db = drizzle(process.env.DATABASE_URL!);

export const auth = betterAuth({
    appName: "Better-Auth",
    plugins: [two_factor_plugin({
        skipVerificationOnEnable: true,
        otpOptions: {
            async sendOTP({ user, otp }, request) {
                await send_email({
                    to: user.email,
                    subject: 'Two Factor Authentication',
                    text: `Your OTP is: ${otp}`
                })
            },
        },
    })],
    database: drizzleAdapter(db, {
        provider: "pg", //@ts-ignore
        schema: {
            user,
            account,
            session,
            verification,
            twoFactor
        },
       
    }),
    socialProviders: {
        google: { 
            clientId: process.env.GOOGLE_CLIENT_ID as string, 
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string, 
        }, 
    },
    
    
    emailAndPassword: {
        enabled: true,
        sendResetPassword: async ({user, url, token}, request) => {
            await send_email({
              to: user.email,
              subject: "Reset your password",
              text: `Click the link to reset your password: ${url}`,
            });
          },
        
    },
    
});


