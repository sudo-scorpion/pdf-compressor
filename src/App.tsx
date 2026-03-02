import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, File as FileIcon, X, ArrowUp, ArrowDown, Settings, Download, Loader2, Info } from 'lucide-react';
import { processPdfs } from './services/pdfService';
import JSZip from 'jszip';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface PdfFile {
  id: string;
  file: File;
  name: string;
  size: number;
}

interface ResultFile {
  blob: Blob;
  name: string;
  size: number;
}

export default function App() {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [quality, setQuality] = useState<number>(0.6);
  const [scale, setScale] = useState<number>(1.5);
  const [merge, setMerge] = useState<boolean>(true);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  
  const [results, setResults] = useState<ResultFile[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addFiles = (newFiles: File[]) => {
    const pdfFiles = newFiles.filter(f => f.type === 'application/pdf');
    const newPdfFiles = pdfFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      name: file.name,
      size: file.size,
    }));
    setFiles(prev => [...prev, ...newPdfFiles]);
    setResults([]); // Clear previous results when new files are added
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const moveFile = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newFiles = [...files];
      [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
      setFiles(newFiles);
    } else if (direction === 'down' && index < files.length - 1) {
      const newFiles = [...files];
      [newFiles[index + 1], newFiles[index]] = [newFiles[index], newFiles[index + 1]];
      setFiles(newFiles);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    setProgress(0);
    setProgressText('Initializing...');
    setResults([]);

    try {
      const rawFiles = files.map(f => f.file);
      const outputFiles = await processPdfs(rawFiles, {
        quality,
        scale,
        merge,
        onProgress: (p, text) => {
          setProgress(p);
          setProgressText(text);
        }
      });
      
      setResults(outputFiles.map(f => ({
        blob: f.blob,
        name: f.name,
        size: f.blob.size
      })));
      
      setProgress(100);
      setProgressText('Complete!');
    } catch (error) {
      console.error("Error processing PDFs:", error);
      setProgressText('Error occurred during processing.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (results.length === 0) return;
    
    if (results.length === 1) {
      const url = URL.createObjectURL(results[0].blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = results[0].name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const zip = new JSZip();
      results.forEach(result => {
        zip.file(result.name, result.blob);
      });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'compressed_pdfs.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const totalOriginalSize = files.reduce((acc, f) => acc + f.size, 0);
  const totalResultSize = results.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900">
            Presentation PDF Compressor
          </h1>
          <p className="text-zinc-500 text-lg">
            Significantly reduce the size of presentation PDFs by rasterizing slides. Optionally merge them into a single file.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Upload Zone */}
            <div 
              className={cn(
                "border-2 border-dashed rounded-2xl p-10 transition-colors duration-200 ease-in-out flex flex-col items-center justify-center text-center cursor-pointer",
                "border-zinc-300 hover:border-indigo-500 hover:bg-indigo-50/50 bg-white"
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                multiple 
                accept=".pdf" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <div className="bg-indigo-100 p-4 rounded-full mb-4 text-indigo-600">
                <UploadCloud size={32} />
              </div>
              <h3 className="text-lg font-semibold text-zinc-800 mb-1">Click or drag PDFs here</h3>
              <p className="text-zinc-500 text-sm">Supports multiple files</p>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
                  <h3 className="font-semibold text-zinc-800">Selected Files ({files.length})</h3>
                  <span className="text-sm text-zinc-500 font-mono">{formatSize(totalOriginalSize)} total</span>
                </div>
                <ul className="divide-y divide-zinc-100 max-h-[400px] overflow-y-auto">
                  {files.map((file, index) => (
                    <li key={file.id} className="p-4 flex items-center gap-4 hover:bg-zinc-50 transition-colors group">
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => moveFile(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-zinc-400 hover:text-zinc-800 disabled:opacity-30"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button 
                          onClick={() => moveFile(index, 'down')}
                          disabled={index === files.length - 1}
                          className="p-1 text-zinc-400 hover:text-zinc-800 disabled:opacity-30"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                      <div className="bg-red-100 text-red-600 p-2 rounded-lg shrink-0">
                        <FileIcon size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800 truncate">{file.name}</p>
                        <p className="text-xs text-zinc-500 font-mono">{formatSize(file.size)}</p>
                      </div>
                      <button 
                        onClick={() => removeFile(file.id)}
                        className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      >
                        <X size={18} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Progress & Results */}
            {(isProcessing || results.length > 0) && (
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 space-y-6">
                {isProcessing ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm font-medium text-zinc-700">
                      <div className="flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin text-indigo-600" />
                        <span>{progressText}</span>
                      </div>
                      <span className="font-mono">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-emerald-700 flex items-center gap-2">
                          Compression Complete!
                        </h3>
                        <p className="text-sm text-zinc-500 mt-1">
                          Reduced from <span className="font-mono font-medium">{formatSize(totalOriginalSize)}</span> to <span className="font-mono font-medium text-emerald-600">{formatSize(totalResultSize)}</span>
                          <span className="ml-2 inline-block bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            -{Math.round((1 - totalResultSize / totalOriginalSize) * 100)}%
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
                      >
                        <Download size={18} />
                        Download {results.length > 1 ? 'ZIP' : 'PDF'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
          </div>

          {/* Sidebar / Settings */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 space-y-6">
              <div className="flex items-center gap-2 text-zinc-800 font-semibold border-b border-zinc-100 pb-4">
                <Settings size={20} className="text-zinc-400" />
                <h2>Settings</h2>
              </div>

              <div className="space-y-5">
                
                {/* Quality Slider */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-zinc-700">JPEG Quality</label>
                    <span className="text-xs font-mono text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md">
                      {Math.round(quality * 100)}%
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="1.0" 
                    step="0.1" 
                    value={quality} 
                    onChange={(e) => setQuality(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <p className="text-xs text-zinc-500">Lower quality = smaller file size but more artifacts.</p>
                </div>

                {/* Scale Slider */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-zinc-700">Resolution Scale</label>
                    <span className="text-xs font-mono text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md">
                      {scale}x
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="3.0" 
                    step="0.25" 
                    value={scale} 
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <p className="text-xs text-zinc-500">Higher scale = sharper text but larger file size. 1.5x is a good default.</p>
                </div>

                {/* Merge Toggle */}
                <div className="pt-2 border-t border-zinc-100">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium text-zinc-700 group-hover:text-zinc-900 transition-colors">Merge into single PDF</span>
                      <p className="text-xs text-zinc-500">Combine all selected files</p>
                    </div>
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={merge}
                        onChange={(e) => setMerge(e.target.checked)}
                      />
                      <div className={cn(
                        "block w-10 h-6 rounded-full transition-colors duration-200",
                        merge ? "bg-indigo-600" : "bg-zinc-200"
                      )}></div>
                      <div className={cn(
                        "absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200",
                        merge ? "transform translate-x-4" : ""
                      )}></div>
                    </div>
                  </label>
                </div>

              </div>

              <div className="pt-6">
                <button
                  onClick={handleProcess}
                  disabled={files.length === 0 || isProcessing}
                  className={cn(
                    "w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 flex justify-center items-center gap-2",
                    files.length === 0 || isProcessing
                      ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                      : "bg-zinc-900 hover:bg-zinc-800 text-white shadow-md hover:shadow-lg"
                  )}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Compress PDFs'
                  )}
                </button>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-3">
              <Info className="text-blue-500 shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-blue-800 space-y-2">
                <p className="font-medium">How it works</p>
                <p className="text-blue-700/80 leading-relaxed">
                  This tool converts each page of your PDF into an image (rasterization). This is highly effective for presentation slides with complex graphics, but it will make the text non-searchable.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
