import { createAuthClient } from "better-auth/client"
const client = createAuthClient()
 
export const signIn = async () => {
    const data = await client.signIn.social({
        provider: "google"
    })
}