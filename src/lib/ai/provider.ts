export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatParams {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CompleteParams extends ChatParams {
  jsonMode?: boolean;
}

export interface CompleteResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AiProvider {
  streamChat(params: ChatParams): AsyncIterable<string>;
  complete(params: CompleteParams): Promise<CompleteResult>;
  countTokens(text: string): number;
}

export type AiProviderName = "moonshot";

export function getAiProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER ?? "moonshot";

  switch (provider) {
    case "moonshot": {
      // Dynamic import avoided at module level to keep tree clean;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { MoonshotProvider } = require("./moonshot") as typeof import("./moonshot");
      return new MoonshotProvider();
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}
