/** Account model catalog retrieval. The API key is supplied transiently and is never retained. */
export interface ModelListClient {
  models: {
    list(): Promise<{ data: Array<{ id?: unknown }> }>;
  };
}

export async function fetchModelIds(client: ModelListClient): Promise<string[]> {
  try {
    const response = await client.models.list();
    if (!response || !Array.isArray(response.data)) {
      throw new Error('Invalid model catalog response');
    }

    const ids = new Set<string>();
    for (const model of response.data) {
      if (model && typeof model.id === 'string') {
        const id = model.id.trim();
        if (id.length > 0 && id.length <= 200) ids.add(id);
      }
    }
    return [...ids].sort((a, b) => a.localeCompare(b));
  } catch {
    // Deliberately discard SDK errors: they can contain request details. Never surface credentials.
    throw new Error('Unable to retrieve the account model catalog. Check API access and try again.');
  }
}

export async function fetchAccountModelIds(apiKey: string): Promise<string[]> {
  if (!apiKey.trim()) throw new Error('Set an API key before retrieving account models.');
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  return fetchModelIds(client);
}
