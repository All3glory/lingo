/**
 * Generate the marketplace icon from media/icon-source.png.
 *
 * The marketplace displays the icon at 128px; 256 keeps it crisp on HiDPI
 * while staying tiny. Run with `npm run icon` whenever the source changes.
 */
import { Jimp } from "jimp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SIZE = 256;

const img = await Jimp.read(join(root, "media", "icon-source.png"));
img.cover({ w: SIZE, h: SIZE });
await img.write(join(root, "media", "icon.png"));

console.log(`media/icon.png -> ${SIZE}x${SIZE}`);
