import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebRTC, HuddleParticipant } from '../../hooks/useWebRTC';
import { useAuthStore } from '../../stores/authStore';
import {
  getSocket,
  huddleStart,
  huddleJoin,
  huddleLeave,
  huddleEnd,
  huddleHand,
} from '../../lib/socket';

interface HuddlePanelProps {
  channelId: string;
  onClose: () => void;
}

export default function HuddlePanel({ channelId, onClose }: HuddlePanelProps) {
  const user = useAuthStore((s) => s.user);
  const {
    participants,
    localStream,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    getLocalStream,
    sendOffer,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    cleanup,
    setParticipants,
  } = useWebRTC(channelId);

  const [handRaised, setHandRaised] = useState(false);
  const [callState, setCallState] = useState<'joining' | 'active' | 'ended'>('joining');
  const [callDuration, setCallDuration] = useState(0);
  const [isInitiator, setIsInitiator] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const durationTimer = useRef<ReturnType<typeof setInterval>>();

  // 加入通话
  const joinCall = useCallback(async (asInitiator = false) => {
    const stream = await getLocalStream(videoEnabled);
    if (!stream) {
      alert('无法获取麦克风权限');
      return;
    }

    if (asInitiator) {
      huddleStart(channelId);
      setIsInitiator(true);
    }
    huddleJoin(channelId);
    setCallState('active');
  }, [channelId, videoEnabled, getLocalStream]);

  // 本地视频预览
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // 通话时长计时
  useEffect(() => {
    if (callState === 'active') {
      durationTimer.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
    }
    return () => {
      if (durationTimer.current) clearInterval(durationTimer.current);
    };
  }, [callState]);

  // 监听 socket 事件
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleParticipantJoined = async ({ userId, displayName, avatarUrl }: any) => {
      if (userId === user?.id) return;
      // 新参与者加入，向其发送 offer
      setParticipants((prev) => {
        const next = new Map(prev);
        next.set(userId, { userId, displayName, avatarUrl, handRaised: false, audioEnabled: true, videoEnabled: false });
        return next;
      });
      // 稍等一下让对方完成 join，再发 offer
      setTimeout(() => sendOffer(userId), 500);
    };

    const handleParticipants = ({ participants: list }: { participants: any[] }) => {
      setParticipants((prev) => {
        const next = new Map(prev);
        list.forEach((p) => {
          if (p.userId !== user?.id) {
            const existing = next.get(p.userId);
            next.set(p.userId, {
              userId: p.userId,
              displayName: p.displayName,
              avatarUrl: p.avatarUrl,
              handRaised: p.handRaised || false,
              audioEnabled: existing?.audioEnabled ?? true,
              videoEnabled: existing?.videoEnabled ?? false,
              stream: existing?.stream,
            });
          }
        });
        return next;
      });
    };

    const handleParticipantLeft = ({ userId }: { userId: string }) => {
      setParticipants((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    };

    const handleEnded = () => {
      setCallState('ended');
      cleanup();
    };

    const handleHandUpdate = ({ userId, raised }: { userId: string; raised: boolean }) => {
      setParticipants((prev) => {
        const next = new Map(prev);
        const p = next.get(userId);
        if (p) next.set(userId, { ...p, handRaised: raised });
        return next;
      });
    };

    socket.on('huddle:participant-joined', handleParticipantJoined);
    socket.on('huddle:participants', handleParticipants);
    socket.on('huddle:participant-left', handleParticipantLeft);
    socket.on('huddle:ended', handleEnded);
    socket.on('huddle:hand-update', handleHandUpdate);

    return () => {
      socket.off('huddle:participant-joined', handleParticipantJoined);
      socket.off('huddle:participants', handleParticipants);
      socket.off('huddle:participant-left', handleParticipantLeft);
      socket.off('huddle:ended', handleEnded);
      socket.off('huddle:hand-update', handleHandUpdate);
    };
  }, [user?.id, sendOffer, cleanup, setParticipants]);

  // 离开通话
  const handleLeave = useCallback(() => {
    huddleLeave(channelId);
    cleanup();
    onClose();
  }, [channelId, cleanup, onClose]);

  // 结束通话（发起者）
  const handleEnd = useCallback(() => {
    huddleEnd(channelId);
    cleanup();
    onClose();
  }, [channelId, cleanup, onClose]);

  // 举手
  const toggleHand = useCallback(() => {
    const next = !handRaised;
    setHandRaised(next);
    huddleHand(channelId, next);
  }, [channelId, handRaised]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const participantList = Array.from(participants.values());

  return (
    <div className="fixed bottom-0 right-4 w-96 bg-white rounded-t-xl shadow-2xl border border-gray-200 z-50 flex flex-col" style={{ maxHeight: '70vh' }}>
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-white rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎧</span>
          <div>
            <div className="text-sm font-semibold">Huddle</div>
            <div className="text-xs text-white/70">{formatDuration(callDuration)} · {participantList.length + 1} 人</div>
          </div>
        </div>
        <button onClick={handleLeave} className="text-white/70 hover:text-white text-lg">✕</button>
      </div>

      {/* 加入中 */}
      {callState === 'joining' && (
        <div className="p-6 text-center">
          <div className="text-4xl mb-3">🎧</div>
          <p className="text-sm text-gray-600 mb-4">加入 Huddle 通话</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => joinCall(false)}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light"
            >
              仅音频加入
            </button>
            <button
              onClick={async () => { await joinCall(false); toggleVideo(); }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
            >
              音频+视频
            </button>
          </div>
        </div>
      )}

      {/* 通话中 */}
      {callState === 'active' && (
        <>
          {/* 视频区域 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ minHeight: '120px' }}>
            {/* 本地视频 */}
            {videoEnabled && (
              <div className="relative rounded-lg overflow-hidden bg-gray-900 aspect-video">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-1 left-1 text-xs text-white bg-black/50 px-1.5 py-0.5 rounded">你</div>
              </div>
            )}

            {/* 远程参与者 */}
            {participantList.map((p) => (
              <ParticipantVideo key={p.userId} participant={p} />
            ))}

            {/* 无视频时的音频列表 */}
            {!videoEnabled && participantList.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-sm">
                等待其他人加入...
              </div>
            )}
          </div>

          {/* 参与者列表（底部） */}
          <div className="px-3 pb-2">
            <div className="flex flex-wrap gap-1">
              {/* 自己 */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-full px-2 py-0.5">
                <div className={`w-2 h-2 rounded-full ${audioEnabled ? 'bg-green-500' : 'bg-red-400'}`} />
                <span className="text-xs text-gray-700">你</span>
                {handRaised && <span className="text-xs">✋</span>}
              </div>
              {participantList.map((p) => (
                <div key={p.userId} className="flex items-center gap-1 bg-gray-100 rounded-full px-2 py-0.5">
                  <div className={`w-2 h-2 rounded-full ${p.audioEnabled ? 'bg-green-500' : 'bg-red-400'}`} />
                  <span className="text-xs text-gray-700">{p.displayName}</span>
                  {p.handRaised && <span className="text-xs">✋</span>}
                </div>
              ))}
            </div>
          </div>

          {/* 控制栏 */}
          <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-gray-100">
            <ControlButton
              icon={audioEnabled ? '🎤' : '🔇'}
              label={audioEnabled ? '静音' : '取消静音'}
              active={audioEnabled}
              onClick={toggleAudio}
            />
            <ControlButton
              icon={videoEnabled ? '📹' : '📷'}
              label={videoEnabled ? '关闭视频' : '开启视频'}
              active={videoEnabled}
              onClick={toggleVideo}
            />
            <ControlButton
              icon={isScreenSharing ? '🖥️' : '💻'}
              label={isScreenSharing ? '停止共享' : '共享屏幕'}
              active={isScreenSharing}
              onClick={toggleScreenShare}
            />
            <ControlButton
              icon={handRaised ? '✋' : '🤚'}
              label={handRaised ? '放下手' : '举手'}
              active={handRaised}
              onClick={toggleHand}
            />
            <button
              onClick={handleLeave}
              className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
              title="离开通话"
            >
              📞
            </button>
            {isInitiator && (
              <button
                onClick={handleEnd}
                className="w-10 h-10 rounded-full bg-red-700 text-white flex items-center justify-center hover:bg-red-800 transition-colors text-sm"
                title="结束所有人通话"
              >
                ⏹
              </button>
            )}
          </div>
        </>
      )}

      {/* 通话已结束 */}
      {callState === 'ended' && (
        <div className="p-6 text-center">
          <div className="text-4xl mb-3">📞</div>
          <p className="text-sm text-gray-600 mb-3">通话已结束 · {formatDuration(callDuration)}</p>
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
            关闭
          </button>
        </div>
      )}
    </div>
  );
}

function ParticipantVideo({ participant }: { participant: HuddleParticipant }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  if (participant.stream) {
    return (
      <div className="relative rounded-lg overflow-hidden bg-gray-900 aspect-video">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <div className="absolute bottom-1 left-1 text-xs text-white bg-black/50 px-1.5 py-0.5 rounded">
          {participant.displayName}
          {participant.handRaised && ' ✋'}
        </div>
        {!participant.audioEnabled && (
          <div className="absolute top-1 right-1 text-xs text-red-400">🔇</div>
        )}
      </div>
    );
  }

  // 无视频流，显示头像
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
        {participant.displayName[0].toUpperCase()}
      </div>
      <div className="flex-1">
        <div className="text-sm text-gray-700">{participant.displayName}</div>
        <div className="flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${participant.audioEnabled ? 'bg-green-500' : 'bg-red-400'}`} />
          <span className="text-xs text-gray-400">{participant.audioEnabled ? '已开启麦克风' : '已静音'}</span>
        </div>
      </div>
      {participant.handRaised && <span className="text-lg">✋</span>}
    </div>
  );
}

function ControlButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
        active ? 'bg-gray-100 hover:bg-gray-200' : 'bg-red-100 hover:bg-red-200'
      }`}
      title={label}
    >
      <span className="text-lg">{icon}</span>
    </button>
  );
}
