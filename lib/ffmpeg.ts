import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

// Point fluent-ffmpeg at the static binary bundled in node_modules
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export default ffmpeg;
