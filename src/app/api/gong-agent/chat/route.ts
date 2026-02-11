import { NextRequest, NextResponse } from 'next/server';
import { trackMetric, trackTiming, addBreadcrumb } from '@/lib/sentry-utils';

interface GongCall {
  id: string;
  title?: string;
  url?: string;
  started?: string;
  duration?: number;
  direction?: string;
  participants?: Array<{
    name?: string;
    email?: string;
    role?: string;
  }>;
}

interface GongCallsResponse {
  calls?: GongCall[];
  totalRecords?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  const requestId = crypto.randomUUID();
  
  try {
    addBreadcrumb('Gong agent chat API called', { requestId });
    trackMetric('gong_agent.chat.api.request', 1);

    const body: ChatRequest = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Get the latest user message
    const userMessages = messages.filter(m => m.role === 'user');
    const latestUserMessage = userMessages[userMessages.length - 1];
    
    if (!latestUserMessage) {
      return NextResponse.json(
        { error: 'No user message found' },
        { status: 400 }
      );
    }

    addBreadcrumb('Processing Gong chat message', {
      messageCount: messages.length,
      requestId,
      userMessageLength: latestUserMessage.content.length
    });

    trackMetric('gong_agent.chat.messages', messages.length);

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Fetch Gong calls data
          const fromDateTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago
          const toDateTime = new Date().toISOString();

          addBreadcrumb('Fetching Gong calls', {
            fromDateTime,
            toDateTime
          });

          let gongData: GongCallsResponse = {};
          let hasGongData = false;

          try {
            const gongResponse = await fetch(`https://api.gong.io/v2/calls?fromDateTime=${encodeURIComponent(fromDateTime)}&toDateTime=${encodeURIComponent(toDateTime)}`, {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${process.env.GONG_API_KEY || ''}`,
                'Content-Type': 'application/json',
              },
            });

            if (gongResponse.ok) {
              gongData = await gongResponse.json();
              hasGongData = true;
            }
          } catch (error) {
            console.error('Failed to fetch Gong data:', error);
            // Continue without Gong data
          }

          addBreadcrumb('Starting Claude Agent SDK query with Gong data', {
            hasGongData,
            requestId
          });

          addBreadcrumb('Gong agent query started', { requestId });

          // Simulate agent processing (replace with actual Claude Agent SDK integration)
          const processingDelay = Math.random() * 3000 + 2000; // 2-5 seconds
          await new Promise(resolve => setTimeout(resolve, processingDelay));

          // Generate response based on user message and Gong data
          let responseContent = '';
          
          if (hasGongData && gongData.calls && gongData.calls.length > 0) {
            responseContent = `Based on your recent Gong calls, I found ${gongData.calls.length} calls from the past week. `;
            
            if (latestUserMessage.content.toLowerCase().includes('summary')) {
              responseContent += `Here's a summary of your recent activity:\n\n`;
              gongData.calls.slice(0, 3).forEach((call, index) => {
                responseContent += `${index + 1}. ${call.title || 'Untitled Call'} - Duration: ${call.duration || 'Unknown'} minutes\n`;
              });
            } else {
              responseContent += `How can I help you analyze this data?`;
            }
          } else {
            responseContent = `I'm ready to help you with Gong call analysis. However, I couldn't fetch your recent call data at the moment. You can ask me about call summaries, participant insights, or any other questions about your sales calls.`;
          }

          // Stream the response content
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'text_delta', text: responseContent })}\n\n`
          ));

          // Signal completion
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'done' })}\n\n`
          ));

          const duration = performance.now() - startTime;
          
          addBreadcrumb('Gong agent request completed', {
            duration,
            requestId,
            tokensGenerated: null,
            toolsUsed: 0
          });

          trackMetric('gong_agent.chat.api.success', 1);
          trackTiming('gong_agent.chat.api.duration', duration, 'millisecond');

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Stream error in Gong agent', error, { requestId });
          
          const duration = performance.now() - startTime;
          trackMetric('gong_agent.chat.api.error.stream', 1);
          trackTiming('gong_agent.chat.api.duration', duration, 'millisecond', { 
            status: 'error' 
          });

          try {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: 'Stream error occurred' })}\n\n`
            ));
          } catch {
            // Controller might already be closed, ignore
          }
          
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    
    console.error('Gong agent chat error:', error);
    
    trackMetric('gong_agent.chat.api.error.init', 1);
    trackTiming('gong_agent.chat.api.duration', duration, 'millisecond', { 
      status: 'error' 
    });
    
    return NextResponse.json(
      { error: 'Failed to process Gong agent request' },
      { status: 500 }
    );
  }
}