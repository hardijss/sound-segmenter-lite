import React, { useRef } from 'react';
import { Upload, Music, FileAudio, Sparkles } from 'lucide-react';

interface AudioUploaderProps {
  onFileUpload: (file: File) => void;
  isLoading: boolean;
  onLoadDemoAudio?: () => void;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({
  onFileUpload,
  isLoading,
  onLoadDemoAudio,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|flac|ogg|m4a|aac)$/i)) {
        onFileUpload(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="upload-container">
      <div
        className="upload-dropzone"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a,.aac"
          className="hidden-file-input"
        />

        <div className="upload-icon-wrapper">
          <Upload className="upload-icon" />
        </div>

        <h3 className="upload-title">Drop audio file here or click to browse</h3>
        <p className="upload-subtitle">
          Supports WAV, MP3, FLAC, OGG, AAC. Automatic 25 FPS sample-exact silence splitting.
        </p>

        {isLoading && (
          <div className="loading-spinner-wrapper">
            <div className="spinner"></div>
            <span>Decoding audio & analyzing frame silence...</span>
          </div>
        )}
      </div>

      {onLoadDemoAudio && !isLoading && (
        <div className="demo-audio-section">
          <button className="demo-btn" onClick={onLoadDemoAudio}>
            <Sparkles className="btn-icon" /> Load Synthesized Demo Audio Track (Speech/Pauses)
          </button>
        </div>
      )}
    </div>
  );
};
