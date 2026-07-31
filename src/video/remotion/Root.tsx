import { Composition } from 'remotion';
import { RedditStory, redditStorySchema } from './compositions/RedditStory';

export const RemotionRoot: React.FC = () => {
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
          const totalFrames = props.scenes.reduce((acc, scene) => acc + scene.durationFrames, 0);
          return {
            durationInFrames: Math.max(totalFrames, 30), // Minimum 1 second
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
