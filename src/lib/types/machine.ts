export type OriginPosition =
	| 'front-left' | 'front-center' | 'front-right'
	| 'left' | 'center' | 'right'
	| 'back-left' | 'back-center' | 'back-right';

export interface MachineConfig {
	/** Safe Z height for rapid moves (mm) */
	safeZ: number;
	/** Origin X offset (mm) */
	originX: number;
	/** Origin Y offset (mm) */
	originY: number;
	/** Where the XY origin sits on the stock */
	originPosition: OriginPosition;
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
	originY: 0,
	originPosition: 'front-left'
};

export const DEFAULT_STOCK_CONFIG: StockConfig = {
	width: 200,
	height: 200,
	thickness: 10
};

/** Compute G-code origin offsets from an origin position and stock dimensions. */
export function computeOriginOffsets(
	position: OriginPosition,
	stockWidth: number,
	stockHeight: number
): { originX: number; originY: number } {
	const colX = position.includes('left') ? 0
		: position.includes('right') ? -stockWidth
		: -stockWidth / 2;
	const isfront = position.startsWith('front');
	const isback = position.startsWith('back');
	const rowY = isfront ? 0 : isback ? -stockHeight : -stockHeight / 2;
	return { originX: colX, originY: rowY };
}
