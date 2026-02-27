export interface MachineConfig {
	/** Safe Z height for rapid moves (mm) */
	safeZ: number;
	/** Origin X offset (mm) */
	originX: number;
	/** Origin Y offset (mm) */
	originY: number;
}

export interface StockConfig {
	/** Stock width in mm (X axis) */
	width: number;
	/** Stock height in mm (Y axis) */
	height: number;
	/** Stock thickness in mm (Z axis) */
	thickness: number;
}

export const DEFAULT_MACHINE_CONFIG: MachineConfig = {
	safeZ: 5,
	originX: 0,
	originY: 0
};

export const DEFAULT_STOCK_CONFIG: StockConfig = {
	width: 200,
	height: 200,
	thickness: 10
};
