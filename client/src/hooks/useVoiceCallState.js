import { useEffect, useMemo, useRef, useState } from "react";
import useWebRTCAudioConnection from "./useWebRTCAudioConnection";

export const VOICE_CALL_STATES = Object.freeze({
  idle: "idle",
  calling: "calling",
  incoming: "incoming",
  connected: "connected",
  ended: "ended",
});

const EMPTY_CALL_CONTEXT = {
  chatId: "",
  participantName: "",
  participantUserId: "",
};

const useVoiceCallState = () => {
  const [callState, setCallState] = useState(VOICE_CALL_STATES.idle);
  const [callContext, setCallContext] = useState(EMPTY_CALL_CONTEXT);
  const [incomingCaller, setIncomingCaller] = useState("");
  const [callEndReason, setCallEndReason] = useState("");
  const [localAudioStream, setLocalAudioStream] = useState(null);
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false);
  const [microphoneError, setMicrophoneError] = useState("");
  const [isRequestingMicrophone, setIsRequestingMicrophone] = useState(false);

  const {
    peerConnection,
    peerConnectionRef,
    webRTCError,
    remoteAudioStream,
    registerRemoteAudioElement,
    registerOnIceCandidate,
    addRemoteIceCandidate,
    ensurePeerConnection,
    closePeerConnection,
    createOffer,
    createAnswer,
    setLocalDescription,
    setRemoteDescription,
  } = useWebRTCAudioConnection();

  // Keep a direct stream reference for later peer-connection signaling integration.
  const localAudioStreamRef = useRef(null);

  const isPanelOpen = callState !== VOICE_CALL_STATES.idle;

  const stopLocalAudioStream = () => {
    const activeStream = localAudioStreamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
    }
    localAudioStreamRef.current = null;
    setLocalAudioStream(null);
    setIsMicrophoneMuted(false);
  };

  const toggleMicrophoneMute = () => {
    const activeStream = localAudioStreamRef.current;

    setIsMicrophoneMuted((previous) => {
      const nextMuted = !previous;
      if (activeStream) {
        activeStream.getAudioTracks().forEach((track) => {
          track.enabled = !nextMuted;
        });
      }
      return nextMuted;
    });
  };

  const completeCallTermination = (reason = "Call ended") => {
    closePeerConnection();
    stopLocalAudioStream();
    setCallContext(EMPTY_CALL_CONTEXT);
    setIncomingCaller("");
    setCallEndReason(reason);
    setCallState(VOICE_CALL_STATES.ended);
  };

  const requestMicrophoneAccess = async () => {
    if (localAudioStreamRef.current) {
      return localAudioStreamRef.current;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setMicrophoneError("Microphone is not supported in this browser.");
      return null;
    }

    setMicrophoneError("");
    setIsRequestingMicrophone(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMicrophoneMuted;
      });

      localAudioStreamRef.current = stream;
      setLocalAudioStream(stream);
      return stream;
    } catch (error) {
      if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
        setMicrophoneError("Microphone permission denied. Please allow microphone access.");
      } else if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
        setMicrophoneError("No microphone device was found.");
      } else if (error?.name === "NotReadableError" || error?.name === "TrackStartError") {
        setMicrophoneError("Microphone is currently unavailable. Try closing other apps using it.");
      } else {
        setMicrophoneError("Could not access microphone. Please try again.");
      }
      return null;
    } finally {
      setIsRequestingMicrophone(false);
    }
  };

  const startCall = async ({ chatId, participantName, participantUserId = "" }) => {
    if (!chatId) return false;

    const stream = await requestMicrophoneAccess();
    if (!stream) return false;

    const connection = ensurePeerConnection(stream);
    if (!connection) return false;

    setCallContext({
      chatId: String(chatId),
      participantName: participantName || "",
      participantUserId: participantUserId ? String(participantUserId) : "",
    });
    setCallEndReason("");
    setIncomingCaller("");
    setCallState(VOICE_CALL_STATES.calling);
    return true;
  };

  const receiveIncomingCall = ({ chatId, participantName, participantUserId = "", callerName }) => {
    if (!chatId) return;
    setCallContext({
      chatId: String(chatId),
      participantName: participantName || "",
      participantUserId: participantUserId ? String(participantUserId) : "",
    });
    setCallEndReason("");
    setIncomingCaller(callerName || participantName || "Unknown user");
    setCallState(VOICE_CALL_STATES.incoming);
  };

  const acceptIncomingCall = async () => {
    if (callState !== VOICE_CALL_STATES.incoming) return false;

    const stream = await requestMicrophoneAccess();
    if (!stream) return false;

    const connection = ensurePeerConnection(stream);
    if (!connection) return false;
    return true;
  };

  const rejectIncomingCall = () => {
    if (callState !== VOICE_CALL_STATES.incoming) return;
    completeCallTermination("Call rejected");
  };

  const markCallConnected = () => {
    setCallState((prev) => {
      if (prev !== VOICE_CALL_STATES.calling && prev !== VOICE_CALL_STATES.incoming) {
        return prev;
      }
      return VOICE_CALL_STATES.connected;
    });
  };

  const endCall = (reason = "Call ended") => {
    completeCallTermination(reason);
  };

  const handleRemoteUserDisconnected = (reason = "The other user disconnected") => {
    completeCallTermination(reason);
  };

  const resetCall = () => {
    closePeerConnection();
    stopLocalAudioStream();
    setCallState(VOICE_CALL_STATES.idle);
    setCallContext(EMPTY_CALL_CONTEXT);
    setIncomingCaller("");
    setCallEndReason("");
    setMicrophoneError("");
  };

  const statusLabel = useMemo(() => {
    const labels = {
      [VOICE_CALL_STATES.idle]: "Idle",
      [VOICE_CALL_STATES.calling]: "Calling...",
      [VOICE_CALL_STATES.incoming]: "Incoming call",
      [VOICE_CALL_STATES.connected]: "Connected",
      [VOICE_CALL_STATES.ended]: "Call ended",
    };
    return labels[callState] || "Idle";
  }, [callState]);

  useEffect(() => {
    if (!webRTCError) return;
    if (callState === VOICE_CALL_STATES.idle || callState === VOICE_CALL_STATES.ended) return;

    completeCallTermination(`Call failed: ${webRTCError}`);
  }, [webRTCError, callState]);

  return {
    callState,
    callContext,
    incomingCaller,
    callEndReason,
    peerConnection,
    peerConnectionRef,
    webRTCError,
    remoteAudioStream,
    registerRemoteAudioElement,
    registerOnIceCandidate,
    addRemoteIceCandidate,
    localAudioStream,
    localAudioStreamRef,
    isMicrophoneMuted,
    microphoneError,
    isRequestingMicrophone,
    isPanelOpen,
    statusLabel,
    ensurePeerConnection,
    closePeerConnection,
    createOffer,
    createAnswer,
    setLocalDescription,
    setRemoteDescription,
    requestMicrophoneAccess,
    stopLocalAudioStream,
    toggleMicrophoneMute,
    startCall,
    receiveIncomingCall,
    acceptIncomingCall,
    rejectIncomingCall,
    markCallConnected,
    endCall,
    handleRemoteUserDisconnected,
    resetCall,
  };
};

export default useVoiceCallState;
