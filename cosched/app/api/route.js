import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const client = typeof clerkClient === 'function' ? await clerkClient() : clerkClient;
    const response = await client.users.getUserOauthAccessToken(userId, 'oauth_google');
    
    const token = response.data?.[0]?.token || response[0]?.token;
    
    if (!token) return new NextResponse(JSON.stringify({ error: "No token found" }), { status: 404 });

    return NextResponse.json({ token });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch token" }, { status: 500 });
  }
}