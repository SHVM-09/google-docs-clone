import { redirect } from '@sveltejs/kit';

export const GET = async ({ url, fetch }) => {
    // Extract Google auth code from URL
    const searchParams = new URLSearchParams(url.search);
    console.log(searchParams);
    const code = searchParams.get('code');
    console.log('Google auth code:', code);
    try {
        // Post the Google auth code and workspaceId to your API
        const res = await fetch(`http://localhost:3000/auth/google`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code, userId: "12345" })
        });

        if (!res.ok) {
            throw new Error('Failed to Authenticate with Google');
        } else {
            const data = await res.json();
        }
    } catch (e) {
        console.error('Error during Google Meet authentication:', e);
    }
    throw redirect(302, `http://localhost:5173/docs`);
};