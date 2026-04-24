import { useRef, useState } from "react";

const WEBRTC_CONFIGURATION = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const getWebRTCErrorMessage = (error) => {
  if (!error?.message) {
    return "Unable to initialize WebRTC audio connection.";
  }
  return error.message;
};

const useWebRTCAudioConnection = () => {
  const [peerConnection, setPeerConnection] = useState(null);
  const [webRTCError, setWebRTCError] = useState("");
  const [remoteAudioStream, setRemoteAudioStream] = useState(null);
  const peerConnectionRef = useRef(null);
  const onIceCandidateCallbackRef = useRef(null);
  const pendingRemoteCandidatesRef = useRef([]);
  const remoteAudioElementRef = useRef(null);

  const attachRemoteAudioToElement = async (stream) => {
    const audioElement = remoteAudioElementRef.current;
    if (!audioElement || !stream) return;

    if (audioElement.srcObject !== stream) {
      audioElement.srcObject = stream;
    }

    audioElement.autoplay = true;
    audioElement.playsInline = true;

    try {
      await audioElement.play();
    } catch {
      // Autoplay can be blocked; browser will usually allow after user interaction.
    }
  };

  const attachLocalAudioTracks = (connection, localAudioStream) => {
    if (!connection || !localAudioStream) return;

    const audioTracks = localAudioStream.getAudioTracks();
    audioTracks.forEach((track) => {
      const alreadyAttached = connection
        .getSenders()
        .some((sender) => sender.track?.id === track.id);

      if (!alreadyAttached) {
        connection.addTrack(track, localAudioStream);
      }
    });
  };

  const ensurePeerConnection = (localAudioStream) => {
    const existingConnection = peerConnectionRef.current;
    if (existingConnection && existingConnection.connectionState !== "closed") {
      attachLocalAudioTracks(existingConnection, localAudioStream);
      return existingConnection;
    }

    if (typeof RTCPeerConnection === "undefined") {
      setWebRTCError("WebRTC is not supported in this browser.");
      return null;
    }

    try {
      const connection = new RTCPeerConnection(WEBRTC_CONFIGURATION);
      connection.onicecandidate = (event) => {
        if (!event.candidate || !onIceCandidateCallbackRef.current) return;
        onIceCandidateCallbackRef.current(event.candidate);
      };
      connection.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;
        setRemoteAudioStream(stream);
        attachRemoteAudioToElement(stream);
      };
      peerConnectionRef.current = connection;
      setPeerConnection(connection);
      setWebRTCError("");
      attachLocalAudioTracks(connection, localAudioStream);
      return connection;
    } catch (error) {
      setWebRTCError(getWebRTCErrorMessage(error));
      return null;
    }
  };

  const closePeerConnection = () => {
    const activeConnection = peerConnectionRef.current;
    if (activeConnection) {
      activeConnection.onicecandidate = null;
      activeConnection.ontrack = null;
      activeConnection.close();
    }

    const audioElement = remoteAudioElementRef.current;
    if (audioElement) {
      audioElement.srcObject = null;
    }

    peerConnectionRef.current = null;
    pendingRemoteCandidatesRef.current = [];
    setPeerConnection(null);
    setRemoteAudioStream(null);
  };

  const registerRemoteAudioElement = (element) => {
    remoteAudioElementRef.current = element || null;

    if (element && remoteAudioStream) {
      attachRemoteAudioToElement(remoteAudioStream);
    }
  };

  const registerOnIceCandidate = (callback) => {
    onIceCandidateCallbackRef.current = callback || null;

    return () => {
      if (onIceCandidateCallbackRef.current === callback) {
        onIceCandidateCallbackRef.current = null;
      }
    };
  };

  const flushPendingRemoteCandidates = async (connection) => {
    if (!connection?.remoteDescription) return;

    const queued = [...pendingRemoteCandidatesRef.current];
    pendingRemoteCandidatesRef.current = [];

    for (const candidate of queued) {
      try {
        await connection.addIceCandidate(candidate);
      } catch (error) {
        setWebRTCError(getWebRTCErrorMessage(error));
      }
    }
  };

  const setLocalDescription = async (description, localAudioStream) => {
    if (!description) return null;
    const connection = ensurePeerConnection(localAudioStream);
    if (!connection) return null;

    try {
      await connection.setLocalDescription(description);
      return connection.localDescription;
    } catch (error) {
      setWebRTCError(getWebRTCErrorMessage(error));
      return null;
    }
  };

  const setRemoteDescription = async (description, localAudioStream) => {
    if (!description) return null;
    const connection = ensurePeerConnection(localAudioStream);
    if (!connection) return null;

    try {
      await connection.setRemoteDescription(description);
      await flushPendingRemoteCandidates(connection);
      return connection.remoteDescription;
    } catch (error) {
      setWebRTCError(getWebRTCErrorMessage(error));
      return null;
    }
  };

  const addRemoteIceCandidate = async (candidateInit, localAudioStream) => {
    if (!candidateInit) return false;

    const connection = ensurePeerConnection(localAudioStream);
    if (!connection) return false;

    try {
      const candidate =
        candidateInit instanceof RTCIceCandidate
          ? candidateInit
          : new RTCIceCandidate(candidateInit);

      if (!connection.remoteDescription) {
        pendingRemoteCandidatesRef.current.push(candidate);
        return true;
      }

      await connection.addIceCandidate(candidate);
      return true;
    } catch (error) {
      setWebRTCError(getWebRTCErrorMessage(error));
      return false;
    }
  };

  const createOffer = async (localAudioStream) => {
    const connection = ensurePeerConnection(localAudioStream);
    if (!connection) return null;

    try {
      const offer = await connection.createOffer();
      await setLocalDescription(offer, localAudioStream);
      return offer;
    } catch (error) {
      setWebRTCError(getWebRTCErrorMessage(error));
      return null;
    }
  };

  const createAnswer = async (localAudioStream) => {
    const connection = ensurePeerConnection(localAudioStream);
    if (!connection) return null;

    try {
      const answer = await connection.createAnswer();
      await setLocalDescription(answer, localAudioStream);
      return answer;
    } catch (error) {
      setWebRTCError(getWebRTCErrorMessage(error));
      return null;
    }
  };

  return {
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
  };
};

export default useWebRTCAudioConnection;
