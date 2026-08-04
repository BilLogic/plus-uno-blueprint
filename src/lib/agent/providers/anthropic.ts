import {
  ProviderError,
  readErrorDetail,
  type AgentMessage,
  type AgentProviderAdapter,
  type AgentTextPart,
  type AgentToolCallPart,
  type ChatInput,
  type ChatResult,
} from './provider'

const BASE = 'https://api.anthropic.com/v1'

type AnthropicBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

type AnthropicMessage = { role: 'user' | 'assistant'; content: AnthropicBlock[] }

function toMessages(messages: AgentMessage[]): AnthropicMessage[] {
  return messages.map((message): AnthropicMessage => {
    switch (message.role) {
      case 'user':
        return {
          role: 'user',
          content: message.parts.map((p) => ({ type: 'text' as const, text: p.text })),
        }
      case 'assistant':
        return {
          role: 'assistant',
          content: message.parts.map((part): AnthropicBlock =>
            part.type === 'text'
              ? { type: 'text', text: part.text }
              : { type: 'tool_use', id: part.id, name: part.name, input: part.args },
          ),
        }
      case 'tool':
        // Tool results ride a user-role turn in the Messages API.
        return {
          role: 'user',
          content: message.parts.map((part): AnthropicBlock => ({
            type: 'tool_result',
            tool_use_id: part.toolCallId,
            content: part.result,
            ...(part.isError ? { is_error: true } : {}),
          })),
        }
    }
  })
}

export const anthropicAdapter: AgentProviderAdapter = {
  id: 'anthropic',
  async chat(input: ChatInput): Promise<ChatResult> {
    const response = await fetch(`${BASE}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': input.apiKey,
        'anthropic-version': '2023-06-01',
        // Browser-direct calls are an explicit opt-in with Anthropic; the
        // BYO-key design accepts this (key is the user's own, localStorage).
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      signal: input.signal,
      body: JSON.stringify({
        model: input.model,
        max_tokens: 4096,
        system: input.system,
        messages: toMessages(input.messages),
        ...(input.tools.length > 0
          ? {
              tools: input.tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.parameters,
              })),
            }
          : {}),
      }),
    })
    if (!response.ok)
      throw new ProviderError('anthropic', response.status, await readErrorDetail(response))

    const body = (await response.json()) as {
      content?: AnthropicBlock[]
      stop_reason?: string
    }
    const parts: Array<AgentTextPart | AgentToolCallPart> = []
    for (const block of body.content ?? []) {
      if (block.type === 'text') parts.push({ type: 'text', text: block.text })
      else if (block.type === 'tool_use')
        parts.push({ type: 'tool_call', id: block.id, name: block.name, args: block.input })
    }
    return {
      parts,
      stopReason: body.stop_reason === 'tool_use' ? 'tool_use' : 'end',
    }
  },
}
