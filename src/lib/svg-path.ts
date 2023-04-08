export function createPath(x1: number, y1: number, x2: number, y2: number): string {
    const hx1 = x1 + Math.abs(x2 - x1) * 0.4;
    const hx2 = x2 - Math.abs(x2 - x1) * 0.4;

    return `M ${x1} ${y1} C ${hx1} ${y1} ${hx2} ${y2} ${x2} ${y2}`;
}
