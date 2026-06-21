import { useRef, useCallback, useEffect, useState } from 'react';
import { getSocket, huddleOffer, huddleAnswer, huddleIceCandidate } from '../lib/socket';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export interface HuddleParticipant {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  handRaised: boolean;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export function useWebRTC(channelId: string) {
  const [participants, setParticipants] = useState<Map<string, HuddleParticipant>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreams = useRef<Map<string, MediaStream>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  // 创建 PeerConnection
  const createPeerConnection = useCallback((peerUserId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // 添加本地流
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    // ICE candidate 事件
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        huddleIceCandidate(channelId, peerUserId, event.candidate.toJSON());
      }
    };

    // 接收远程流
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      remoteStreams.current.set(peerUserId, remoteStream);
      setParticipants((prev) => {
        const next = new Map(prev);
        const existing = next.get(peerUserId);
        if (existing) {
          next.set(peerUserId, { ...existing, stream: remoteStream });
        }
        return next;
      });
    };

    // 连接状态变化
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        pc.close();
        peerConnections.current.delete(peerUserId);
        remoteStreams.current.delete(peerUserId);
        setParticipants((prev) => {
          const next = new Map(prev);
          next.delete(peerUserId);
          return next;
        });
      }
    };

    peerConnections.current.set(peerUserId, pc);
    return pc;
  }, [channelId]);

  // 发起 offer 给新参与者
  const sendOffer = useCallback(async (peerUserId: string) => {
    let pc = peerConnections.current.get(peerUserId);
    if (!pc) {
      pc = createPeerConnection(peerUserId);
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      huddleOffer(channelId, peerUserId, pc.localDescription!);
    } catch (err) {
      console.error('[WebRTC] Create offer error:', err);
    }
  }, [channelId, createPeerConnection]);

  // 获取本地媒体流
  const getLocalStream = useCallback(async (withVideo = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo ? { width: 640, height: 480 } : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setAudioEnabled(true);
      setVideoEnabled(withVideo);
      return stream;
    } catch (err) {
      console.error('[WebRTC] getUserMedia error:', err);
      // 尝试仅音频
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setAudioEnabled(true);
        setVideoEnabled(false);
        return stream;
      } catch (err2) {
        console.error('[WebRTC] Audio only also failed:', err2);
        return null;
      }
    }
  }, []);

  // 切换音频
  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setAudioEnabled(audioTrack.enabled);
    }
  }, []);

  // 切换视频
  const toggleVideo = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    if (!videoEnabled) {
      // 开启视频
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        const videoTrack = videoStream.getVideoTracks()[0];

        // 替换所有 peer connection 的视频 track
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, stream);
          }
        });

        stream.addTrack(videoTrack);
        setVideoEnabled(true);
      } catch (err) {
        console.error('[WebRTC] Enable video error:', err);
      }
    } else {
      // 关闭视频
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        stream.removeTrack(videoTrack);
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(null as any);
        });
      }
      setVideoEnabled(false);
    }
  }, [videoEnabled]);

  // 屏幕共享
  const toggleScreenShare = useCallback(async () => {
    if (!isScreenSharing) {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenTrack = screen.getVideoTracks()[0];

        // 替换视频 track 为屏幕共享
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          } else {
            pc.addTrack(screenTrack, localStreamRef.current!);
          }
        });

        screenTrack.onended = () => {
          // 屏幕共享停止，恢复摄像头
          setIsScreenSharing(false);
          setScreenStream(null);
          if (videoEnabled && localStreamRef.current) {
            const camTrack = localStreamRef.current.getVideoTracks()[0];
            if (camTrack) {
              peerConnections.current.forEach((pc) => {
                const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(camTrack);
              });
            }
          }
        };

        setScreenStream(screen);
        setIsScreenSharing(true);
      } catch (err) {
        console.error('[WebRTC] Screen share error:', err);
      }
    } else {
      // 停止屏幕共享
      screenStream?.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      setIsScreenSharing(false);

      // 恢复摄像头
      if (videoEnabled && localStreamRef.current) {
        const camTrack = localStreamRef.current.getVideoTracks()[0];
        if (camTrack) {
          peerConnections.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(camTrack);
          });
        }
      }
    }
  }, [isScreenSharing, screenStream, videoEnabled]);

  // 监听 socket 信令事件
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // 收到 offer
    const handleOffer = async ({ fromUserId, offer }: { fromUserId: string; offer: RTCSessionDescriptionInit }) => {
      let pc = peerConnections.current.get(fromUserId);
      if (!pc) {
        pc = createPeerConnection(fromUserId);
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        huddleAnswer(channelId, fromUserId, pc.localDescription!);
      } catch (err) {
        console.error('[WebRTC] Handle offer error:', err);
      }
    };

    // 收到 answer
    const handleAnswer = async ({ fromUserId, answer }: { fromUserId: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnections.current.get(fromUserId);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error('[WebRTC] Handle answer error:', err);
      }
    };

    // 收到 ICE candidate
    const handleIceCandidate = async ({ fromUserId, candidate }: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnections.current.get(fromUserId);
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[WebRTC] Add ICE candidate error:', err);
      }
    };

    socket.on('huddle:offer', handleOffer);
    socket.on('huddle:answer', handleAnswer);
    socket.on('huddle:ice-candidate', handleIceCandidate);

    return () => {
      socket.off('huddle:offer', handleOffer);
      socket.off('huddle:answer', handleAnswer);
      socket.off('huddle:ice-candidate', handleIceCandidate);
    };
  }, [channelId, createPeerConnection]);

  // 清理
  const cleanup = useCallback(() => {
    // 关闭所有 peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    remoteStreams.current.clear();

    // 停止本地流
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    // 停止屏幕共享
    screenStream?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
    setIsScreenSharing(false);

    setParticipants(new Map());
    setAudioEnabled(true);
    setVideoEnabled(false);
  }, [screenStream]);

  return {
    participants,
    localStream,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    screenStream,
    getLocalStream,
    sendOffer,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    cleanup,
    setParticipants,
  };
}
