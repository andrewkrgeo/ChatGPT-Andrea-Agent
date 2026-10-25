import {fetchAccountModelIds} from './modelCatalog';

export const BUILTIN_MODELS = ['gpt-6-luna', 'gpt-6.1-sol', 'gpt-6-astra'] as const;
export const CUSTOM_MODEL_NOTICE = 'Custom/account model: Responses API, tools, reasoning settings and pricing are not verified. Listing does not prove compatibility.';

/** Ephemeral catalog only; retrieval never changes or persists the active selection. */
export class ModelSelection {
  ids: string[] = [];
  loaded = false;
  busy = false;
  private generation = 0;
  invalidate() { this.generation++; this.ids = []; this.loaded = false; }
  isBuiltin(id: string) { return (BUILTIN_MODELS as readonly string[]).includes(id); }
  canSelect(id: string) { return this.isBuiltin(id) || this.ids.includes(id); }
  isStale(id: string) { return this.loaded && !this.isBuiltin(id) && !this.ids.includes(id); }
  async retrieve(key: string | undefined, fetcher = fetchAccountModelIds): Promise<string> {
    if (this.busy) return 'Model retrieval is already in progress.';
    if (!key?.trim()) return 'Set an API key before retrieving account models. Active model unchanged.';
    this.busy = true;
    const generation = this.generation;
    try {
      const ids = await fetcher(key);
      if (generation !== this.generation) return 'Credentials changed. Retrieve models again. Active model unchanged.';
      this.ids = ids; this.loaded = true;
      return ids.length ? 'Account models retrieved. Select a model explicitly. ' + CUSTOM_MODEL_NOTICE : 'No account models returned. Active model unchanged.';
    } catch {
      return 'Unable to retrieve account models. Check API access and try again. Active model unchanged.';
    } finally { this.busy = false; }
  }
}
