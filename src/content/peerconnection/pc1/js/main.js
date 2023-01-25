/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');
callButton.disabled = true;
hangupButton.disabled = true;
startButton.addEventListener('click', start);
callButton.addEventListener('click', call);
hangupButton.addEventListener('click', hangup);

let startTime;
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

localVideo.addEventListener('loadedmetadata', function() {
  console.log(`Local video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
});

remoteVideo.addEventListener('loadedmetadata', function() {
  console.log(`Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
});

remoteVideo.addEventListener('resize', () => {
  console.log(`Remote video size changed to ${remoteVideo.videoWidth}x${remoteVideo.videoHeight} - Time since pageload ${performance.now().toFixed(0)}ms`);
  // We'll use the first onsize callback as an indication that video has started
  // playing out.
  if (startTime) {
    const elapsedTime = window.performance.now() - startTime;
    console.log('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
    startTime = null;
  }
});

let localStream;
let localConnection;
let remoteConnection;
const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

function getName(pc) {
  return (pc === localConnection) ? 'localConnection' : 'remoteConnection';
}

function getOtherPc(pc) {
  return (pc === localConnection) ? remoteConnection : localConnection;
}

async function start() {
  console.log('Requesting local stream');
  startButton.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
    console.log('Received local stream');
    localVideo.srcObject = stream;
    localStream = stream;
    callButton.disabled = false;
  } catch (e) {
    alert(`getUserMedia() error: ${e.name}`);
  }
}

async function call() {
  callButton.disabled = true;
  hangupButton.disabled = false;
  console.log('Starting call');
  startTime = window.performance.now();
  const videoTracks = localStream.getVideoTracks();
  const audioTracks = localStream.getAudioTracks();
  if (videoTracks.length > 0) {
    console.log(`Using video device: ${videoTracks[0].label}`);
  }
  if (audioTracks.length > 0) {
    console.log(`Using audio device: ${audioTracks[0].label}`);
  }
  const configuration = {};
  console.log('RTCPeerConnection configuration:', configuration);
  localConnection = new RTCPeerConnection(configuration);
  console.log('Created local peer connection object localConnection');
  localConnection.addEventListener('icecandidate', e => onIceCandidate(localConnection, e));
  remoteConnection = new RTCPeerConnection(configuration);
  console.log('Created remote peer connection object remoteConnection');
  remoteConnection.addEventListener('icecandidate', e => onIceCandidate(remoteConnection, e));
  localConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(localConnection, e));
  remoteConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(remoteConnection, e));
  remoteConnection.addEventListener('track', gotRemoteStream);

  localStream.getTracks().forEach(track => localConnection.addTrack(track, localStream));
  console.log('Added local stream to localConnection');

  try {
    console.log('localConnection createOffer start');
    const offer = await localConnection.createOffer(offerOptions);
    await onCreateOfferSuccess(offer);
  } catch (e) {
    onCreateSessionDescriptionError(e);
  }
}

function onCreateSessionDescriptionError(error) {
  console.log(`Failed to create session description: ${error.toString()}`);
}

async function onCreateOfferSuccess(desc) {
  console.log(`Offer from localConnection\n${desc.sdp}`);
  console.log('localConnection setLocalDescription start');
  try {
    await localConnection.setLocalDescription(desc);
    onSetLocalSuccess(localConnection);
  } catch (e) {
    onSetSessionDescriptionError();
  }

  console.log('remoteConnection setRemoteDescription start');
  try {
    await remoteConnection.setRemoteDescription(desc);
    onSetRemoteSuccess(remoteConnection);
  } catch (e) {
    onSetSessionDescriptionError();
  }

  console.log('remoteConnection createAnswer start');
  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
  try {
    const answer = await remoteConnection.createAnswer();
    await onCreateAnswerSuccess(answer);
  } catch (e) {
    onCreateSessionDescriptionError(e);
  }
}

function onSetLocalSuccess(pc) {
  console.log(`${getName(pc)} setLocalDescription complete`);
}

function onSetRemoteSuccess(pc) {
  console.log(`${getName(pc)} setRemoteDescription complete`);
}

function onSetSessionDescriptionError(error) {
  console.log(`Failed to set session description: ${error.toString()}`);
}

function gotRemoteStream(e) {
  if (remoteVideo.srcObject !== e.streams[0]) {
    remoteVideo.srcObject = e.streams[0];
    console.log('remoteConnection received remote stream');
  }
}

async function onCreateAnswerSuccess(desc) {
  console.log(`Answer from remoteConnection:\n${desc.sdp}`);
  console.log('remoteConnection setLocalDescription start');
  try {
    await remoteConnection.setLocalDescription(desc);
    onSetLocalSuccess(remoteConnection);
  } catch (e) {
    onSetSessionDescriptionError(e);
  }
  console.log('localConnection setRemoteDescription start');
  try {
    await localConnection.setRemoteDescription(desc);
    onSetRemoteSuccess(localConnection);
  } catch (e) {
    onSetSessionDescriptionError(e);
  }
}

async function onIceCandidate(pc, event) {
  try {
    await (getOtherPc(pc).addIceCandidate(event.candidate));
    onAddIceCandidateSuccess(pc);
  } catch (e) {
    onAddIceCandidateError(pc, e);
  }
  console.log(`${getName(pc)} ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
}

function onAddIceCandidateSuccess(pc) {
  console.log(`${getName(pc)} addIceCandidate success`);
}

function onAddIceCandidateError(pc, error) {
  console.log(`${getName(pc)} failed to add ICE Candidate: ${error.toString()}`);
}

function onIceStateChange(pc, event) {
  if (pc) {
    console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
    console.log('ICE state change event: ', event);
  }
}

function hangup() {
  console.log('Ending call');
  localConnection.close();
  remoteConnection.close();
  localConnection = null;
  remoteConnection = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
}
