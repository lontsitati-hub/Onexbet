import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

export default function EmptyBetHistoryMascot() {
  const player = useVideoPlayer(require('../../assets/videos/bet-history-empty.mp4'), (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.pause();
  });

  useEffect(() => {
    player.currentTime = 0;
    player.play();
    return () => player.pause();
  }, [player]);

  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls={false}
      fullscreenOptions={{ enable: false }}
      accessibilityLabel="Animation de la mascotte lorsqu’il n’y a aucun pari"
    />
  );
}

const styles = StyleSheet.create({
  video: {
    width: '100%',
    maxWidth: 420,
    aspectRatio: 560 / 480,
    marginBottom: 12,
    pointerEvents: 'none',
  },
});
