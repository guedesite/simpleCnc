import { writable } from 'svelte/store';
import { DEFAULT_MACHINE_CONFIG, DEFAULT_STOCK_CONFIG, type MachineConfig, type StockConfig } from '$lib/types/machine.js';

export const machineConfig = writable<MachineConfig>({ ...DEFAULT_MACHINE_CONFIG });
export const stockConfig = writable<StockConfig>({ ...DEFAULT_STOCK_CONFIG });
