// liquid-gl ships no types; this covers the options the home slide uses.
declare module 'liquid-gl' {
  interface LiquidGLOptions {
    target: string;
    snapshot?: string;
    zIndex?: number;
    resolution?: number;
    content?: string | false;
    frost?: number;
    refraction?: number;
    bevelDepth?: number;
    bevelWidth?: number;
    shadow?: boolean;
    specular?: boolean;
    reveal?: 'none' | 'fade';
  }
  type Lens = { destroy: () => void };
  const liquidGL: ((options: LiquidGLOptions) => Lens | Lens[] | undefined) | undefined;
  export default liquidGL;
}
