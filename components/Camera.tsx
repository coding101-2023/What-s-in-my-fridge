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
      
      // Resize logic
      const MAX_DIMENSION = 800;
      let width = video.videoWidth;
      let height = video.videoHeight;
      
      if (width > height) {
        if (width > MAX_DIMENSION) {
          height = Math.round(height * (MAX_DIMENSION / width));
          width = MAX_DIMENSION;
        }
      } else {
        if (height > MAX_DIMENSION) {
          width = Math.round(width * (MAX_DIMENSION / height));
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
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
    <div className="fixed inset-0 bg-forest-green/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
      <RetroCard className="w-full max-w-lg flex flex-col items-center relative gap-4 h-full max-h-[90vh]" color="cream">
         <button 
          onClick={() => { stopCamera(); onClose(); }}
          className="absolute top-4 right-4 bg-red-400 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-soft hover:bg-red-500 transition-colors z-10"
        >
          ✕
        </button>
        
        <h2 className="text-2xl font-display font-bold text-forest-green mt-2 text-center w-full tracking-wide">
            {label} 🍃
        </h2>

        {error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center min-h-[300px] flex-1">
            <div className="text-6xl mb-4">🌰</div>
            <div className="text-red-500 font-bold font-body text-xl mb-4">{error}</div>
            {permissionDenied && (
              <p className="text-lg mb-4 text-gray-600 font-body">
                Please allow camera access in your browser settings.
              </p>
            )}
            <button 
              onClick={startCamera}
              className="bg-sky-blue text-white px-8 py-3 rounded-full shadow-soft hover:shadow-soft-lg font-display text-lg transition-all"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Viewfinder */}
            <div className="relative w-full flex-1 bg-black rounded-3xl overflow-hidden shadow-soft-lg border-4 border-white">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 text-white font-body text-lg">
                 {capturedImages.length} Captured
              </div>
            </div>
            
            <canvas ref={canvasRef} className="hidden" />

            {/* Thumbnails Strip */}
            {capturedImages.length > 0 && (
              <div className="w-full h-20 flex gap-2 overflow-x-auto p-2 bg-white/50 rounded-2xl">
                {capturedImages.map((img, idx) => (
                  <div key={idx} className="h-full aspect-square rounded-xl overflow-hidden relative shrink-0 shadow-sm border border-white">
                    <img src={`data:image/jpeg;base64,${img}`} className="w-full h-full object-cover" alt="thumb" />
                    <button 
                       onClick={() => setCapturedImages(capturedImages.filter((_, i) => i !== idx))}
                       className="absolute top-1 right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Controls */}
            <div className="w-full flex justify-between items-center px-4 py-2">
               <div className="w-16"></div> {/* Spacer */}
               
               <button
                onClick={captureFrame}
                className="w-20 h-20 rounded-full bg-white border-4 border-gray-200 flex items-center justify-center active:scale-95 transition-all shadow-soft-lg group"
              >
                <div className="w-16 h-16 rounded-full bg-red-400 group-hover:bg-red-500 transition-colors border-4 border-white"></div>
              </button>

              <div className="w-16 flex justify-end">
                {capturedImages.length > 0 && (
                   <button 
                     onClick={handleFinish}
                     className="bg-forest-green text-white w-14 h-14 rounded-full shadow-soft flex items-center justify-center hover:bg-green-800 transition-colors"
                   >
                     <span className="text-2xl">✓</span>
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