/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Provider, Message } from "../base";
import { Prompt } from "../prompt";
import { TranslateQuery, ProviderProps } from "../types";
import { fetchSSE, SSETransform } from "../utils";
/* @ts-expect-error: has no exported member 'compose' */
import { compose } from "stream";

export default class extends Provider {
  protected model: string | undefined;
  protected entrypoint: string;
  protected apikey: string | undefined; //

  constructor(props: ProviderProps) {
    super(props);
    this.model = props.apiModel;
    this.entrypoint = props.entrypoint;
    this.apikey = props.apikey;
  }

  protected async *doTranslate(query: TranslateQuery, prompt: Prompt): AsyncGenerator<Message> {
    const body = this.body(query, prompt);
    const messages = this.messages(query, prompt);
    const headers = this.headers(query, prompt);

    const isFirst = true;

    const messageParser = this.handleMessage(prompt);

    body["messages"] = messages;

    const options = {
      ...this.options(query, prompt),
      body: JSON.stringify(body),
      headers,
    };
    const source = fetchSSE(`${this.entrypoint}`, options);

    yield* compose(source, new SSETransform(), messageParser);
  }

  headers(query: TranslateQuery, prompt: Prompt): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apikey && this.apikey != "none") {
      headers["Authorization"] = `Bearer ${this.apikey}`;
    }
    return headers;
  }

  body(query: TranslateQuery, prompt: Prompt): Record<string, any> {
    return {
      model: this.model,
      temperature: 0,
      max_tokens: 1000,
      top_p: 1,
      frequency_penalty: 1,
      presence_penalty: 1,
      stream: true,
    };
  }

  messages(query: TranslateQuery, prompt: Prompt): any {
    const { rolePrompt, assistantPrompts, commandPrompt, contentPrompt } = prompt;

    return [
      {
        role: "system",
        content: rolePrompt,
      },
      ...assistantPrompts.map((prompt) => {
        return {
          role: "user",
          content: prompt,
        };
      }),
      {
        role: "user",
        content: commandPrompt,
      },
      {
        role: "user",
        content: contentPrompt,
      },
    ];
  }

  handleMessage(prompt: Prompt): (source: any) => AsyncGenerator<Message> {
    return async function* (source) {
      for await (const chunk of source) {
        if (chunk) {
          const { quoteProcessor, meta } = prompt;
          const { isWordMode } = meta;
          let resp;
          try {
            resp = JSON.parse(chunk.data);
            const { choices } = resp;
            if (!choices || choices.length === 0) {
              console.debug({ error: "No result" });
            } else {
              const choice = choices[0];
              
              // Process content first
              let targetTxt = "";
              const delta = choice.delta || {};
              const content = delta.content || "";
              const role = delta.role;
              
              if (content) {
                targetTxt = content;
                if (quoteProcessor) {
                  targetTxt = quoteProcessor.processText(targetTxt);
                }
                yield { content: targetTxt, role, isWordMode };
              }
              
              // Then check for finish reason
              const { finish_reason: finishReason } = choice;
              if (finishReason) {
                yield finishReason;
              }
            }
          } catch (error) {
            console.debug({ error: "Parse error" });
            yield "stop";
          }
        } else {
          console.debug("chunk is null");
        }
      }
    };
  }

  options(query: TranslateQuery, prompt: Prompt) {
    return {
      method: "POST",
      signal: query.signal,
      agent: query.agent,
    };
  }
}
