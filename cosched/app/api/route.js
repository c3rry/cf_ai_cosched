// app/api/getToken/route.js
import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    // Handle both Clerk v4 and v5 SDK versions
    const client = typeof clerkClient === 'function' ? await clerkClient() : clerkClient;
    const response = await client.users.getUserOauthAccessToken(userId, 'oauth_google');
    
    // Extract the raw Google Access Token
    const token = response.data?.[0]?.token || response[0]?.token;
    
    if (!token) {
        return new NextResponse(JSON.stringify({ error: "No Google token found. Did you log in with Google?" }), { status: 404 });
    }

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Token Fetch Error:", error);
    return NextResponse.json({ error: "Failed to fetch token from Clerk" }, { status: 500 });
  }
}