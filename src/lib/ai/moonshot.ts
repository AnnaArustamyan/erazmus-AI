import type {
  AiProvider,
  ChatParams,
  CompleteParams,
  CompleteResult,
} from "./provider";

interface MoonshotStreamChunk {
  choices: Array<{
    delta: { content?: string };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class MoonshotProvider implements AiProvider {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.MOONSHOT_API_KEY ?? "";
    this.baseUrl = process.env.MOONSHOT_API_URL ?? "https://api.moonshot.cn/v1";
    this.defaultModel = process.env.MOONSHOT_MODEL ?? "moonshot-v1-8k";

    if (!this.apiKey && process.env.NODE_ENV === "production") {
      throw new Error("MOONSHOT_API_KEY is required in production");
    }
  }

  async *streamChat(params: ChatParams): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model ?? this.defaultModel,
        messages: params.messages,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Moonshot API error: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;

        try {
          const chunk = JSON.parse(trimmed.slice(6)) as MoonshotStreamChunk;
          const content = chunk.choices[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }

  async complete(params: CompleteParams): Promise<CompleteResult> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model ?? this.defaultModel,
        messages: params.messages,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0.7,
        response_format: params.jsonMode ? { type: "json_object" } : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Moonshot API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content ?? "",
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    };
  }

  countTokens(text: string): number {
    // Rough estimate: ~4 chars per token for English text
    return Math.ceil(text.length / 4);
  }
}
