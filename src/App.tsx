import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  UploadCloud, File as FileIcon, X, ArrowUp, ArrowDown, 
  Settings, Download, Loader2, Info, Moon, Sun, 
  Layers, Type, Image as ImageIcon, Briefcase, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { processPdfs } from './services/pdfService';
import { extractTextFromPdf } from './services/ocrService';
import { pdfToImages } from './services/imageService';
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

type ToolType = 'compress' | 'ocr' | 'to-image';

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolType>('compress');
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [files, setFiles] = useState<PdfFile[]>([]);
  const [quality, setQuality] = useState<number>(0.6);
  const [scale, setScale] = useState<number>(1.5);
  const [merge, setMerge] = useState<boolean>(true);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  
  const [results, setResults] = useState<ResultFile[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
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
    setResults([]); 
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
      if (activeTool === 'compress') {
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
      } else if (activeTool === 'ocr') {
        // OCR typically processes one file at a time in this simple UI
        const file = rawFiles[0];
        const text = await extractTextFromPdf(file, (p, t) => {
          setProgress(p);
          setProgressText(t);
        });
        const blob = new Blob([text], { type: 'text/plain' });
        setResults([{
          blob,
          name: `${file.name.replace('.pdf', '')}_extracted.txt`,
          size: blob.size
        }]);
      } else if (activeTool === 'to-image') {
        const allImages: ResultFile[] = [];
        for (const file of rawFiles) {
          const images = await pdfToImages(file, scale);
          allImages.push(...images.map(img => ({
            blob: img.blob,
            name: img.name,
            size: img.blob.size
          })));
        }
        setResults(allImages);
      }
      
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
      a.download = 'ultimate_pdf_collection.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const totalOriginalSize = files.reduce((acc, f) => acc + f.size, 0);
  const totalResultSize = results.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg text-white">
                <Briefcase size={20} />
              </div>
              <span className="text-xl font-bold tracking-tight">Ultimate PDF Suite</span>
            </div>
            
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6 md:p-12 lg:grid lg:grid-cols-12 lg:gap-8">
        
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3 space-y-4 mb-8 lg:mb-0">
          <button 
            onClick={() => setActiveTool('compress')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200",
              activeTool === 'compress' 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30" 
                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-800"
            )}
          >
            <Layers size={20} />
            Compress & Merge
          </button>
          <button 
            onClick={() => setActiveTool('ocr')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200",
              activeTool === 'ocr' 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30" 
                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-800"
            )}
          >
            <Type size={20} />
            OCR (Text Recognition)
          </button>
          <button 
            onClick={() => setActiveTool('to-image')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200",
              activeTool === 'to-image' 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30" 
                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-800"
            )}
          >
            <ImageIcon size={20} />
            PDF to Image
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="lg:col-span-6 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 capitalize">
              {activeTool.replace('-', ' ')}
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              {activeTool === 'compress' && "Significantly reduce PDF size by rasterizing slides."}
              {activeTool === 'ocr' && "Extract searchable text from PDF slides or images."}
              {activeTool === 'to-image' && "Convert PDF pages into high-quality JPEG or PNG images."}
            </p>
          </div>

          {/* Upload Zone */}
          <div 
            className={cn(
              "border-2 border-dashed rounded-3xl p-12 transition-all duration-300 ease-in-out flex flex-col items-center justify-center text-center cursor-pointer",
              "border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 bg-white dark:bg-zinc-900 shadow-sm"
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
            <div className="bg-indigo-100 dark:bg-indigo-900/50 p-6 rounded-2xl mb-6 text-indigo-600 dark:text-indigo-400">
              <UploadCloud size={40} />
            </div>
            <h3 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Drop your PDFs here</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">Supports multiple files • Max 50MB per file</p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">Selected Files ({files.length})</h3>
                  <span className="text-xs text-zinc-400 font-mono">({formatSize(totalOriginalSize)})</span>
                </div>
                <button 
                  onClick={() => setFiles([])}
                  className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 size={14} />
                  Clear All
                </button>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[400px] overflow-y-auto">
                {files.map((file, index) => (
                  <li key={file.id} className="p-4 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => moveFile(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-zinc-400 hover:text-indigo-600 disabled:opacity-30"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button 
                        onClick={() => moveFile(index, 'down')}
                        disabled={index === files.length - 1}
                        className="p-1 text-zinc-400 hover:text-indigo-600 disabled:opacity-30"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                    <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-2.5 rounded-xl shrink-0">
                      <FileIcon size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{file.name}</p>
                      <p className="text-xs text-zinc-500 font-mono">{formatSize(file.size)}</p>
                    </div>
                    <button 
                      onClick={() => removeFile(file.id)}
                      className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shrink-0"
                    >
                      <X size={20} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Progress & Results */}
          {(isProcessing || results.length > 0) && (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8 space-y-6">
              {isProcessing ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <div className="flex items-center gap-3">
                      <Loader2 size={20} className="animate-spin text-indigo-600" />
                      <span className="text-zinc-700 dark:text-zinc-300">{progressText}</span>
                    </div>
                    <span className="font-mono text-indigo-600">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-500">
                      Success!
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                      {activeTool === 'compress' ? (
                        <>
                          Reduced by <span className="font-mono font-bold text-emerald-600">
                            {Math.round((1 - totalResultSize / totalOriginalSize) * 100)}%
                          </span>
                        </>
                      ) : (
                        "Task completed successfully."
                      )}
                    </p>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/40"
                  >
                    <Download size={20} />
                    Download Result
                  </button>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Right Sidebar - Settings */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
            <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200 font-bold border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <Settings size={20} className="text-zinc-400" />
              <h2>Settings</h2>
            </div>

            <div className="space-y-6">
              {activeTool === 'compress' && (
                <>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">JPEG Quality</label>
                      <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                        {Math.round(quality * 100)}%
                      </span>
                    </div>
                    <input 
                      type="range" min="0.1" max="1.0" step="0.1" value={quality} 
                      onChange={(e) => setQuality(parseFloat(e.target.value))}
                      className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Resolution</label>
                      <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                        {scale}x
                      </span>
                    </div>
                    <input 
                      type="range" min="0.5" max="3.0" step="0.25" value={scale} 
                      onChange={(e) => setScale(parseFloat(e.target.value))}
                      className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <div className="space-y-0.5">
                        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Merge Files</span>
                        <p className="text-xs text-zinc-500">Output a single PDF</p>
                      </div>
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" className="sr-only peer" checked={merge}
                          onChange={(e) => setMerge(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-indigo-600 rounded-full"></div>
                      </div>
                    </label>
                  </div>
                </>
              )}

              {activeTool === 'ocr' && (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl">
                  OCR settings will appear here. Defaulting to English (Auto-detect).
                </div>
              )}

              {activeTool === 'to-image' && (
                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Format</label>
                      <select className="bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg text-sm px-2 py-1">
                        <option>JPEG</option>
                        <option>PNG</option>
                      </select>
                   </div>
                </div>
              )}
            </div>

            <button
              onClick={handleProcess}
              disabled={files.length === 0 || isProcessing}
              className={cn(
                "w-full py-4 px-6 rounded-2xl font-bold transition-all duration-300 flex justify-center items-center gap-3",
                files.length === 0 || isProcessing
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                  : "bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>Start Action</>
              )}
            </button>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-3xl p-6 flex gap-4">
            <Info className="text-indigo-500 shrink-0 mt-1" size={24} />
            <div className="text-sm text-indigo-900 dark:text-indigo-300 space-y-2">
              <p className="font-bold">Did you know?</p>
              <p className="leading-relaxed opacity-80">
                Ultimate PDF Suite runs entirely in your browser. Your files never leave your computer, ensuring 100% privacy and security.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
