import React, { useRef, useState, useEffect } from 'react';
import RetroCard from './RetroCard';

interface CameraProps {
  onCapture: (base64Images: string[]) => void;
  onClose: () => void;
  label: string;
}

const Camera: React.FC<CameraProps> = ({ onCapture, onClose, label }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    setError('');
    setPermissionDenied(false);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission was denied. Please allow access.');
        setPermissionDenied(true);
      } else if (err.name === 'NotFoundError') {
        setError('No camera device found on your system.');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is currently in use by another application.');
      } else {
        setError('Could not access camera: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64 = dataUrl.split(',')[1];
        setCapturedImages(prev => [...prev, base64]);
      }
    }
  };

  const handleFinish = () => {
    if (capturedImages.length > 0) {
      stopCamera();
      onCapture(capturedImages);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-2">
      <RetroCard className="w-full max-w-lg flex flex-col items-center relative gap-2 h-full max-h-[90vh]" color="cream">
         <button 
          onClick={() => { stopCamera(); onClose(); }}
          className="absolute top-2 right-2 bg-mario-red text-white w-10 h-10 border-4 border-black flex items-center justify-center font-display shadow-pixel-sm active:translate-y-1 active:shadow-none z-10"
        >
          X
        </button>
        
        <h2 className="text-xl font-display text-black mt-2 mb-2 text-center w-full">{label}</h2>

        {error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center min-h-[300px] flex-1">
            <div className="text-4xl mb-4">🚫</div>
            <div className="text-mario-red font-bold font-body text-xl mb-4">{error}</div>
            {permissionDenied && (
              <p className="text-lg mb-4 text-black font-body">
                Please allow camera access in your browser settings.
              </p>
            )}
            <button 
              onClick={startCamera}
              className="bg-mario-blue text-white px-6 py-4 border-4 border-black shadow-pixel hover:translate-y-1 hover:shadow-none font-display text-sm"
            >
              TRY AGAIN
            </button>
          </div>
        ) : (
          <>
            {/* Viewfinder */}
            <div className="relative w-full flex-1 bg-black overflow-hidden border-4 border-black shadow-pixel-sm">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 right-2 text-white font-body text-shadow text-center text-xl bg-black/50 px-2 py-1 border-2 border-white">
                 {capturedImages.length} PHOTOS TAKEN
              </div>
            </div>
            
            <canvas ref={canvasRef} className="hidden" />

            {/* Thumbnails Strip */}
            {capturedImages.length > 0 && (
              <div className="w-full h-20 flex gap-2 overflow-x-auto p-1 border-2 border-black bg-mario-bg">
                {capturedImages.map((img, idx) => (
                  <div key={idx} className="h-full aspect-square border-2 border-white relative shrink-0">
                    <img src={`data:image/jpeg;base64,${img}`} className="w-full h-full object-cover" alt="thumb" />
                    <button 
                       onClick={() => setCapturedImages(capturedImages.filter((_, i) => i !== idx))}
                       className="absolute -top-2 -right-2 bg-mario-red text-white text-xs w-5 h-5 flex items-center justify-center border-2 border-black"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Controls */}
            <div className="w-full flex justify-between items-center px-4 py-2 gap-4">
               <div className="w-16"></div> {/* Spacer */}
               
               <button
                onClick={captureFrame}
                className="w-20 h-20 rounded-full bg-white border-4 border-black flex items-center justify-center active:scale-95 transition-all shadow-pixel"
              >
                <div className="w-16 h-16 rounded-full bg-mario-red border-2 border-black"></div>
              </button>

              <div className="w-16 flex justify-end">
                {capturedImages.length > 0 && (
                   <button 
                     onClick={handleFinish}
                     className="bg-mario-green text-white p-3 border-4 border-black shadow-pixel active:translate-y-1 active:shadow-none"
                   >
                     <span className="font-display text-xs">OK!</span>
                   </button>
                )}
              </div>
            </div>
          </>
        )}
      </RetroCard>
    </div>
  );
};

export default Camera;