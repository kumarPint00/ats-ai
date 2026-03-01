declare module "openai" {
  interface OpenAIConfig {
    apiKey?: string;
  }
  class OpenAI {
    constructor(config: OpenAIConfig);
    embeddings: {
      create(options: { model: string; input: string | string[] }): Promise<any>;
    };
  }
  export default OpenAI;
}
