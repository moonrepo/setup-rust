import os from 'os';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
export const CARGO_HOME = process.env.CARGO_HOME || path.join(os.homedir(), '.cargo');
