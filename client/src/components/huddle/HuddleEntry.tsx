import { useState, useEffect, useCallback } from 'react';
import { getSocket, huddleStart, huddleCheck } from '../../lib/socket';
import { useChannelStore } from '../../stores/channelStore';
import { useAuthStore } from '../../stores/authStore';
import HuddlePanel from './HuddlePanel';

export default function HuddleEntry() {
  const currentChannel = useChannelStore((s) => s.currentChannel);
  const user = useAuthStore((s) => s.user);
  const [activeHuddle, setActiveHuddle] = useState<{ callId: string; channelId: string; participants: any[]; startedAt: string } | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ callId: string; channelId: string; from: any } | null>(null);

  // 检查当前频道是否有活跃通话
  useEffect(() => {
    if (!currentChannel) return;
    huddleCheck(currentChannel.id);
  }, [currentChannel?.id]);

  // 监听 socket 事件
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleIncoming = (data: any) => {
      if (data.channelId === currentChannel?.id) {
        setActiveHuddle({
          callId: data.callId,
          channelId: data.channelId,
          participants: [],
          startedAt: new Date().toISOString(),
        });
        // 如果不是自己发起的，显示来电通知
        if (data.from.id !== user?.id) {
          setIncomingCall(data);
        }
      }
    };

    const handleActive = (data: any) => {
      if (data.channelId === currentChannel?.id) {
        setActiveHuddle(data);
      }
    };

    const handleInactive = ({ channelId }: { channelId: string }) => {
      if (channelId === currentChannel?.id) {
        setActiveHuddle(null);
        setShowPanel(false);
      }
    };

    const handleEnded = ({ channelId }: { channelId: string }) => {
      if (channelId === currentChannel?.id) {
        setActiveHuddle(null);
        setShowPanel(false);
      }
    };

    socket.on('huddle:incoming', handleIncoming);
    socket.on('huddle:active', handleActive);
    socket.on('huddle:inactive', handleInactive);
    socket.on('huddle:ended', handleEnded);

    return () => {
      socket.off('huddle:incoming', handleIncoming);
      socket.off('huddle:active', handleActive);
      socket.off('huddle:inactive', handleInactive);
      socket.off('huddle:ended', handleEnded);
    };
  }, [currentChannel?.id, user?.id]);

  const startHuddle = useCallback(() => {
    if (!currentChannel) return;
    huddleStart(currentChannel.id);
    setShowPanel(true);
    setIncomingCall(null);
  }, [currentChannel]);

  const joinHuddle = useCallback(() => {
    setShowPanel(true);
    setIncomingCall(null);
  }, []);

  const declineCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  if (!currentChannel) return null;

  return (
    <>
      {/* 频道头部的 Huddle 状态指示 */}
      {activeHuddle && !showPanel && (
        <div className="flex items-center gap-2">
          <button
            onClick={joinHuddle}
            className="flex items-center gap-1.5 px-3 py-1 bg-green-500 text-white rounded-full text-xs font-medium hover:bg-green-600 transition-colors animate-pulse"
          >
            <span>🎧</span>
            <span>Huddle 进行中 ({activeHuddle.participants.length}人)</span>
            <span className="ml-1 underline">加入</span>
          </button>
        </div>
      )}

      {/* 发起 Huddle 按钮 */}
      {!activeHuddle && !showPanel && (
        <button
          onClick={startHuddle}
          className="flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-primary hover:bg-gray-100 rounded transition-colors text-xs"
          title="发起 Huddle 通话"
        >
          🎧 <span>Huddle</span>
        </button>
      )}

      {/* 来电通知 */}
      {incomingCall && !showPanel && (
        <div className="fixed top-4 right-4 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50 animate-bounce">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
              {incomingCall.from.displayName?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">{incomingCall.from.displayName} 发起了 Huddle</div>
              <div className="text-xs text-gray-400">点击加入通话</div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={joinHuddle}
              className="flex-1 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
            >
              加入
            </button>
            <button
              onClick={declineCall}
              className="flex-1 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
            >
              忽略
            </button>
          </div>
        </div>
      )}

      {/* 通话面板 */}
      {showPanel && currentChannel && (
        <HuddlePanel
          channelId={currentChannel.id}
          onClose={() => { setShowPanel(false); setActiveHuddle(null); }}
        />
      )}
    </>
  );
}
