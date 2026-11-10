// Pieces of data in the Protection & Capacity views (N2-009): each piece is a lettered block, and
// its copies share the letter and tint, so a viewer can say "C has copies on N1 and N3".
import { DataBlock, blockLetter } from '../../components/parts';

/** One piece of data, drawn as a lettered block about `r` * 2 wide. */
export function Shape({ kind, x, y, r, cls, style }: { kind: number; x: number; y: number; r: number; cls: string; style?: Record<string, string | number> }) {
  return <DataBlock x={x} y={y} letter={blockLetter(kind)} tint={kind} size={Math.max(14, r * 1.6)} cls={cls} style={style} />;
}
