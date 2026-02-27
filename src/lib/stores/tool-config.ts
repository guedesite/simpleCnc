import { writable } from 'svelte/store';
import { DEFAULT_TOOL_CONFIG, type ToolConfig } from '$lib/types/tool.js';

export const toolConfig = writable<ToolConfig>({ ...DEFAULT_TOOL_CONFIG });
