export function CanvasBackground() {
	return (
		<svg
			aria-hidden
			className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
		>
			<title>Canvas background</title>
			<pattern
				id="canvas-bg-dots"
				width={16}
				height={16}
				patternUnits="userSpaceOnUse"
				x={0.5}
				y={0.5}
			>
				<circle cx={0.5} cy={0.5} r={0.5} fill="var(--canvas-dots)" />
			</pattern>
			<rect width="100%" height="100%" fill="url(#canvas-bg-dots)" />
		</svg>
	)
}
