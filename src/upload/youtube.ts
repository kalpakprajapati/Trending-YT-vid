export class YouTubeUploader {
  /**
   * TODO: Implement in Phase 2
   * Authenticate with YouTube API using OAuth2.
   * This will load saved credentials or prompt user to log in.
   */
  async authenticate(): Promise<void> {
    throw new Error('Not implemented yet. Coming in Phase 2.');
  }

  /**
   * TODO: Implement in Phase 2
   * Upload a generated video to YouTube.
   * 
   * @param videoPath - Path to the rendered video file
   * @param metadata - Video title, description, and tags
   * @returns The YouTube video ID or URL upon success
   */
  async upload(videoPath: string, metadata: { title: string; description: string; tags: string[] }): Promise<string> {
    throw new Error('Not implemented yet. Coming in Phase 2.');
  }
}
