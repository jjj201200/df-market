/** Recharts custom bar shape that reads `color` from data entry */
export default function ColoredBar(props: Record<string, unknown>) {
  const {fill, x, y, width, height, color} = props as {
    fill: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
  };
  return <rect x={x} y={y} width={width} height={height} rx={4} fill={color ?? fill} />;
}
