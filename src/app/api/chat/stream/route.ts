import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth/session";
import { getAiProvider } from "@/lib/ai/provider";
import { ERASMUS_CHAT_SYSTEM_PROMPT } from "@/lib/ai/prompts/chat";
import {
  deductTokens,
  getTokenBalance,
  hasSufficientTokens,
} from "@/lib/tokens/ledger";

const MIN_ESTIMATED_TOKENS = 500;

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const user = await requireSessionUser();
    const body = await request.json();
    const chatId = body.chatId as string | undefined;
    const content = (body.message as string | undefined)?.trim();

    if (!chatId || !content) {
      return new Response(
        JSON.stringify({ error: "chatId and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: user.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 20,
        },
      },
    });

    if (!chat) {
      return new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const provider = getAiProvider();
    const estimatedTokens = provider.countTokens(content) + MIN_ESTIMATED_TOKENS;

    const sufficient = await hasSufficientTokens(user.id, estimatedTokens);
    if (!sufficient) {
      const balance = await getTokenBalance(user.id);
      return new Response(
        JSON.stringify({
          error: "Insufficient tokens",
          balance,
          required: estimatedTokens,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }

    await prisma.message.create({
      data: { chatId, role: "USER", content },
    });

    if (chat.messages.length === 0) {
      const title =
        content.length > 60 ? `${content.slice(0, 57)}...` : content;
      await prisma.chat.update({
        where: { id: chatId },
        data: { title },
      });
    }

    const history = [
      { role: "system" as const, content: ERASMUS_CHAT_SYSTEM_PROMPT },
      ...chat.messages.map((m) => ({
        role: (m.role === "USER"
          ? "user"
          : m.role === "ASSISTANT"
            ? "assistant"
            : "system") as "user" | "assistant" | "system",
        content: m.content,
      })),
      { role: "user" as const, content },
    ];

    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of provider.streamChat({ messages: history })) {
            fullResponse += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`),
            );
          }

          const inputTokens = provider.countTokens(
            history.map((m) => m.content).join(" "),
          );
          const outputTokens = provider.countTokens(fullResponse);
          const totalTokens = inputTokens + outputTokens;

          await prisma.message.create({
            data: {
              chatId,
              role: "ASSISTANT",
              content: fullResponse,
              tokens: totalTokens,
            },
          });

          await deductTokens(user.id, totalTokens, `chat:${chatId}`, {
            chatId,
            inputTokens,
            outputTokens,
          });

          await prisma.aiRequest.create({
            data: {
              userId: user.id,
              chatId,
              model: process.env.MOONSHOT_MODEL ?? "moonshot-v1-8k",
              inputTokens,
              outputTokens,
              totalTokens,
              durationMs: Date.now() - startTime,
              success: true,
            },
          });

          await prisma.chat.update({
            where: { id: chatId },
            data: { updatedAt: new Date() },
          });

          const newBalance = await getTokenBalance(user.id);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, tokensUsed: totalTokens, balance: newBalance })}\n\n`,
            ),
          );
          controller.close();
        } catch (error) {
          console.error("[chat/stream]", error);
          await prisma.aiRequest.create({
            data: {
              userId: user.id,
              chatId,
              model: process.env.MOONSHOT_MODEL ?? "moonshot-v1-8k",
              durationMs: Date.now() - startTime,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            },
          });
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "AI generation failed. Please try again." })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("[chat/stream]", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
