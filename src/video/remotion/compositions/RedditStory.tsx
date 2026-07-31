import {
  AbsoluteFill, Audio, Img, Video, Sequence,
  useCurrentFrame, useVideoConfig,
  interpolate, spring, interpolateColors, staticFile,
} from 'remotion';
import { z } from 'zod';

// ─── Schema ────────────────────────────────────────────────────────────────
export const redditStorySchema = z.object({
  title: z.string(),
  scenes: z.array(z.object({
    text: z.string(),
    durationFrames: z.number(),
    emotion: z.string().optional(),
  })),
  audioPath: z.string().optional(),
  backgroundVideo: z.string().optional(),
  // NEW: per-scene AI-generated background images (filenames in public dir)
  sceneImages: z.array(z.string()).optional(),
  // Style mode: 'gradient' (animated bg) or 'cinematic' (AI images) or 'flow' (AI video) or 'manual' (Manual videos)
  style: z.enum(['gradient', 'cinematic', 'flow', 'manual']).optional(),
  // Whether to show subtitles on screen
  showSubtitles: z.boolean().optional(),
});

export type RedditStoryProps = z.infer<typeof redditStorySchema>;

// ─── Constants ─────────────────────────────────────────────────────────────
const ACCENT_COLORS: Record<string, string> = {
  dramatic: '#ff4444', funny: '#ffcc00', suspenseful: '#aa44ff',
  neutral: '#44aaff', wholesome: '#ff66aa',
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Composition
// ═══════════════════════════════════════════════════════════════════════════
export const RedditStory: React.FC<RedditStoryProps> = ({
  title, scenes, audioPath, sceneImages, style = 'gradient', showSubtitles = false
}) => {
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  const useCinematic = (style === 'cinematic' || style === 'flow' || style === 'manual') && sceneImages && sceneImages.length > 0;

  // Calculate scene start frames
  let cumulativeFrame = 0;
  const sceneTimings = scenes.map((scene, i) => {
    const start = cumulativeFrame;
    cumulativeFrame += scene.durationFrames;
    return { ...scene, startFrame: start, image: sceneImages?.[i] || '' };
  });

  return (
    <AbsoluteFill>
      {/* Layer 1: Background — gradient OR per-scene images */}
      {useCinematic ? (
        // Cinematic mode: show each scene's AI image with Ken Burns
        sceneTimings.map((scene, i) => (
          <Sequence key={`bg-${i}`} from={scene.startFrame} durationInFrames={scene.durationFrames}>
            {scene.image ? (
              <KenBurnsImage src={staticFile(scene.image)} duration={scene.durationFrames} index={i} />
            ) : (
              <AnimatedBackground />
            )}
          </Sequence>
        ))
      ) : (
        <AnimatedBackground />
      )}

      {/* Layer 2: Dark overlay */}
      <AbsoluteFill style={{
        background: useCinematic
          ? 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.25) 30%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.85) 100%)'
          : 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.7) 100%)',
      }} />

      {/* Layer 3: Audio */}
      {audioPath && <Audio src={staticFile(audioPath)} />}

      {/* Layer 4: Title card */}
      <TitleCard title={title} />

      {/* Layer 5: Scene overlays */}
      {sceneTimings.map((scene, index) => (
        <Sequence key={index} from={scene.startFrame} durationInFrames={scene.durationFrames}>
          <SceneOverlay
            text={scene.text}
            emotion={scene.emotion || 'neutral'}
            duration={scene.durationFrames}
            sceneIndex={index}
            totalScenes={scenes.length}
            showSubtitles={showSubtitles}
          />
        </Sequence>
      ))}

      {/* Layer 6: Progress bar */}
      <ProgressBar progress={frame / durationInFrames} />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Ken Burns Image (slow zoom + pan on a static image)
// ═══════════════════════════════════════════════════════════════════════════
const KenBurnsImage: React.FC<{ src: string; duration: number; index: number }> = ({ src, duration, index }) => {
  const frame = useCurrentFrame();

  // Alternate zoom direction per scene for variety
  const zoomIn = index % 2 === 0;
  const scale = interpolate(
    frame,
    [0, duration],
    zoomIn ? [1.0, 1.18] : [1.18, 1.0],
    { extrapolateRight: 'clamp' }
  );

  // Subtle horizontal drift
  const panX = interpolate(
    frame,
    [0, duration],
    zoomIn ? [0, -2] : [-2, 0],
    { extrapolateRight: 'clamp' }
  );

  // Crossfade in
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ opacity }}>
      {src.endsWith('.mp4') ? (
        <Video
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale}) translateX(${panX}%)`,
          }}
          muted
          loop
        />
      ) : (
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale}) translateX(${panX}%)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Animated Gradient Background (original style)
// ═══════════════════════════════════════════════════════════════════════════
const AnimatedBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const bg = interpolateColors(
    frame,
    [0, durationInFrames * 0.33, durationInFrames * 0.66, durationInFrames],
    ['#0f0c29', '#302b63', '#24243e', '#0f0c29']
  );

  const orbs = [
    { cx: 30, cy: 25, r: 300, color: 'rgba(99, 102, 241, 0.15)', speed: 0.3 },
    { cx: 70, cy: 60, r: 250, color: 'rgba(236, 72, 153, 0.12)', speed: 0.5 },
    { cx: 50, cy: 80, r: 350, color: 'rgba(59, 130, 246, 0.1)', speed: 0.2 },
    { cx: 20, cy: 70, r: 200, color: 'rgba(168, 85, 247, 0.14)', speed: 0.4 },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: bg, overflow: 'hidden' }}>
      {orbs.map((orb, i) => {
        const offsetX = Math.sin(frame * orb.speed * 0.02 + i) * 60;
        const offsetY = Math.cos(frame * orb.speed * 0.015 + i * 2) * 40;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${orb.cx + offsetX * 0.1}%`,
            top: `${orb.cy + offsetY * 0.1}%`,
            width: orb.r, height: orb.r, borderRadius: '50%',
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            transform: 'translate(-50%, -50%)', filter: 'blur(40px)',
          }} />
        );
      })}
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Title Card
// ═══════════════════════════════════════════════════════════════════════════
const TitleCard: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slideIn = spring({ frame, fps, config: { damping: 18, mass: 0.8 } });
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      position: 'absolute', top: 60, left: 30, right: 30,
      transform: `translateY(${interpolate(slideIn, [0, 1], [-40, 0])}px)`,
      opacity, zIndex: 10,
    }}>
      <div style={{
        padding: '24px 30px',
        background: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '20px', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff4500' }} />
          <span style={{ color: '#ff4500', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: '26px' }}>
            Trending Story
          </span>
        </div>
        <div style={{
          color: 'white', fontFamily: 'system-ui, sans-serif',
          fontSize: '40px', fontWeight: 800, lineHeight: 1.25,
          textShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          {title}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Scene Overlay (emoji + karaoke subtitles)
// ═══════════════════════════════════════════════════════════════════════════
const SceneOverlay: React.FC<{
  text: string; emotion: string; duration: number; sceneIndex: number; totalScenes: number; showSubtitles?: boolean;
}> = ({ text, emotion, duration, sceneIndex, totalScenes, showSubtitles }) => (
  <AbsoluteFill>
    {/* Removed EmojiReaction here as per user request */}
    
    {showSubtitles && (
      <KaraokeSubtitle text={text} duration={duration} emotion={emotion} />
    )}
  </AbsoluteFill>
);


// ═══════════════════════════════════════════════════════════════════════════
// Karaoke Subtitle
// ═══════════════════════════════════════════════════════════════════════════
const KaraokeSubtitle: React.FC<{ text: string; duration: number; emotion: string }> = ({ text, duration, emotion }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/);
  const framesPerWord = Math.max(Math.floor(duration / words.length), 1);
  const currentWordIndex = Math.min(Math.floor(frame / framesPerWord), words.length - 1);
  const accentColor = ACCENT_COLORS[emotion] || '#44aaff';

  const cardScale = spring({ frame, fps, config: { damping: 14, mass: 0.5, stiffness: 150 } });
  const cardOpacity = interpolate(frame, [0, 12, duration - 12, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      position: 'absolute', bottom: 160, left: 30, right: 30,
      display: 'flex', justifyContent: 'center',
      transform: `scale(${cardScale})`, opacity: cardOpacity, zIndex: 15,
    }}>
      <div style={{
        padding: '30px 40px',
        background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(16px)',
        borderRadius: '24px', border: `1px solid ${accentColor}33`,
        boxShadow: `0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)`,
        maxWidth: '90%',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 10px', lineHeight: 1.5 }}>
          {words.map((word, i) => {
            const isActive = i === currentWordIndex;
            const isPast = i < currentWordIndex;
            return (
              <span key={i} style={{
                fontFamily: 'system-ui, sans-serif', fontSize: '52px',
                fontWeight: isActive ? 900 : 700,
                color: isActive ? accentColor : isPast ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)',
                textShadow: isActive
                  ? `0 0 20px ${accentColor}88, 0 2px 8px rgba(0,0,0,0.5)`
                  : '0 2px 4px rgba(0,0,0,0.3)',
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
                display: 'inline-block',
              }}>
                {word}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Progress Bar
// ═══════════════════════════════════════════════════════════════════════════
const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: '8px', background: 'rgba(255,255,255,0.1)', zIndex: 30,
    }}>
      <div style={{
        height: '100%', width: `${clampedProgress * 100}%`,
        background: 'linear-gradient(90deg, #ff4500, #ff8c00, #ffd700)',
        borderRadius: '0 4px 4px 0', boxShadow: '0 0 12px rgba(255, 140, 0, 0.6)',
      }} />
    </div>
  );
};
