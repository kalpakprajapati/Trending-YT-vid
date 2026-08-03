import { Composition, getInputProps } from 'remotion';
import { RedditStory, redditStorySchema } from './compositions/RedditStory';

export const RemotionRoot: React.FC = () => {
  const defaultProps: any = getInputProps();

  const calculateDuration = (props: any) => {
    if (!props || !props.scenes) return 1800; // default 60s
    return props.scenes.reduce((acc: number, scene: any) => acc + (scene.durationFrames || 90), 0);
  };

  return (
    <>
      <Composition
        id="StoryVideo"
        component={RedditStory}
        durationInFrames={1800} // This is just the default for the preview
        fps={30}
        width={1080}
        height={1920}
        schema={redditStorySchema}
        calculateMetadata={({ props }) => {
          // Dynamically set the video length based on the sum of all scene durations!
          const totalFrames = calculateDuration(props);
          const isHorizontal = props.format === 'horizontal';
          return {
            durationInFrames: Math.max(totalFrames, 30), // Minimum 1 second
            width: isHorizontal ? 1920 : 1080,
            height: isHorizontal ? 1080 : 1920,
          };
        }}
        defaultProps={{
          title: "Default Title",
          scenes: [
            { text: "This is a test scene with some words", durationFrames: 90, emotion: "dramatic" },
            { text: "Here is another scene to show", durationFrames: 90, emotion: "funny" }
          ],
          audioPath: "",
          backgroundVideo: "",
          sceneImages: [],
          style: "gradient" as const,
        }}
      />
    </>
  );
};
