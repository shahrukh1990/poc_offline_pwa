import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log('Received submission:', data);

    // Simulate a random server failure (e.g., 30% chance of failure)
    if (Math.random() < 0.3) {
      console.log('Simulating server error...');
      // Add a delay to make the "sending" state more visible
      await new Promise(resolve => setTimeout(resolve, 1500));
      return new NextResponse(
        JSON.stringify({ message: 'Internal Server Error' }),
        { status: 500 }
      );
    }

    // Add a delay to make the "sending" state more visible
    await new Promise(resolve => setTimeout(resolve, 1000));

    return new NextResponse(
      JSON.stringify({ message: 'Submission successful', data }),
      { status: 200 }
    );
  } catch (error) {
    return new NextResponse(
      JSON.stringify({ message: 'Invalid request body' }),
      { status: 400 }
    );
  }
}
