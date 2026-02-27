export enum ToolType {
	FlatEnd = 'flat_end',
	BallNose = 'ball_nose',
	VBit = 'v_bit'
}

export interface ToolConfig {
	type: ToolType;
	/** Tool diameter in mm */
	diameter: number;
	/** V-bit angle in degrees (only for V-bit tools) */
	angle: number;
	/** Spindle speed in RPM */
	spindleSpeed: number;
	/** Feed rate in mm/min */
	feedRate: number;
	/** Plunge rate in mm/min */
	plungeRate: number;
}

export const DEFAULT_TOOL_CONFIG: ToolConfig = {
	type: ToolType.FlatEnd,
	diameter: 3.175,
	angle: 60,
	spindleSpeed: 12000,
	feedRate: 800,
	plungeRate: 300
};
