import { useEffect, useMemo, useRef, useState } from "react";
import { VOICE_CALL_STATES } from "../../hooks/useVoiceCallState";

const VoiceCallPanel = ({
  isOpen,
  callState,
  statusLabel,
  participantName,
  incomingCaller,
  hasLocalAudio,
  isMicrophoneMuted,
  callEndReason,
  microphoneError,
  isRequestingMicrophone,
  onToggleMute,
  onAccept,
  onReject,
  onEnd,
  onClose,
}) => {
  const panelRef = useRef(null);
  const dragStateRef = useRef({ dragging: false, pointerId: null, offsetX: 0, offsetY: 0 });
  const [position, setPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const callerDisplayName = incomingCaller || participantName || "Unknown user";

  const clampPosition = (nextX, nextY, panelWidth, panelHeight) => {
    const padding = 8;
    const maxX = Math.max(padding, window.innerWidth - panelWidth - padding);
    const maxY = Math.max(padding, window.innerHeight - panelHeight - padding);

    return {
      x: Math.min(Math.max(nextX, padding), maxX),
      y: Math.min(Math.max(nextY, padding), maxY),
    };
  };

  const handleDragStart = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const panelEl = panelRef.current;
    if (!panelEl) return;

    const rect = panelEl.getBoundingClientRect();
    const pointerOffsetX = event.clientX - rect.left;
    const pointerOffsetY = event.clientY - rect.top;

    dragStateRef.current = {
      dragging: true,
      pointerId: event.pointerId,
      offsetX: pointerOffsetX,
      offsetY: pointerOffsetY,
    };

    setPosition({ x: rect.left, y: rect.top });
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleDragMove = (event) => {
    const dragState = dragStateRef.current;
    if (!dragState.dragging || dragState.pointerId !== event.pointerId) return;

    const panelEl = panelRef.current;
    if (!panelEl) return;

    const nextX = event.clientX - dragState.offsetX;
    const nextY = event.clientY - dragState.offsetY;
    const clamped = clampPosition(nextX, nextY, panelEl.offsetWidth, panelEl.offsetHeight);
    setPosition(clamped);
  };

  const handleDragEnd = (event) => {
    const dragState = dragStateRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    dragStateRef.current = { dragging: false, pointerId: null, offsetX: 0, offsetY: 0 };
    setIsDragging(false);

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => {
    if (!position || !panelRef.current) return;

    const onResize = () => {
      const panelEl = panelRef.current;
      if (!panelEl) return;
      setPosition((prev) => {
        if (!prev) return prev;
        return clampPosition(prev.x, prev.y, panelEl.offsetWidth, panelEl.offsetHeight);
      });
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [position]);

  const panelStyle = useMemo(() => {
    if (!position) return undefined;
    return {
      left: `${position.x}px`,
      top: `${position.y}px`,
      right: "auto",
      bottom: "auto",
    };
  }, [position]);

  if (!isOpen) return null;

  return (
    <div className="voice-call-overlay" role="presentation">
      <div
        ref={panelRef}
        className={`voice-call-panel ${isDragging ? "voice-call-panel--dragging" : ""}`}
        role="dialog"
        aria-modal="false"
        aria-label="Voice call panel"
        style={panelStyle}
      >
        <div
          className="voice-call-header"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <p className={`voice-call-status voice-call-status--${callState}`}>{statusLabel}</p>
          <span className="voice-call-drag-hint">Drag</span>
        </div>
        <h3 className="voice-call-title">Voice Call</h3>

        {callState === VOICE_CALL_STATES.calling && (
          <p className="voice-call-description">Calling {participantName || "your contact"}...</p>
        )}

        {callState === VOICE_CALL_STATES.incoming && (
          <p className="voice-call-description">{callerDisplayName} is calling you.</p>
        )}

        {callState === VOICE_CALL_STATES.connected && (
          <p className="voice-call-description">You are connected with {participantName || "your contact"}.</p>
        )}

        {callState === VOICE_CALL_STATES.ended && (
          <p className="voice-call-description">{callEndReason || "The voice call has ended."}</p>
        )}

        {hasLocalAudio && (
          <p className="voice-call-local-ready">Microphone is ready.</p>
        )}

        {microphoneError && (
          <p className="voice-call-error" role="alert">
            {microphoneError}
          </p>
        )}

        <div className="voice-call-actions">
          {callState === VOICE_CALL_STATES.incoming && (
            <>
              <button
                type="button"
                className="voice-call-btn voice-call-btn--accept"
                onClick={onAccept}
                disabled={isRequestingMicrophone}
              >
                Accept
              </button>
              <button
                type="button"
                className="voice-call-btn voice-call-btn--reject"
                onClick={onReject}
                disabled={isRequestingMicrophone}
              >
                Reject
              </button>
            </>
          )}

          {(callState === VOICE_CALL_STATES.calling ||
            callState === VOICE_CALL_STATES.connected ||
            callState === VOICE_CALL_STATES.incoming) && (
            <button
              type="button"
              className="voice-call-btn voice-call-btn--mute"
              onClick={onToggleMute}
              disabled={isRequestingMicrophone || !hasLocalAudio}
            >
              {isMicrophoneMuted ? "Unmute" : "Mute"}
            </button>
          )}

          {(callState === VOICE_CALL_STATES.calling ||
            callState === VOICE_CALL_STATES.connected ||
            callState === VOICE_CALL_STATES.incoming) && (
            <button
              type="button"
              className="voice-call-btn voice-call-btn--end"
              onClick={onEnd}
              disabled={isRequestingMicrophone}
            >
              End Call
            </button>
          )}

          {callState === VOICE_CALL_STATES.ended && (
            <button
              type="button"
              className="voice-call-btn voice-call-btn--close"
              onClick={onClose}
              disabled={isRequestingMicrophone}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceCallPanel;
