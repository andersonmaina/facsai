import React, { useState, useRef, useCallback } from 'react';
import { Upload, ImageIcon, Square, Trash2, Send, Settings, Globe } from 'lucide-react';

const FACS = () => {
  const [activeTab, setActiveTab] = useState('annotation');
  const [image, setImage] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [boundingBox, setBoundingBox] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 });
  const [view, setView] = useState('crl');
  const [category, setCategory] = useState('head');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [apiUrl, setApiUrl] = useState(localStorage.getItem('facs_api_url') || '');
  const [connectionType, setConnectionType] = useState(localStorage.getItem('facs_conn_type') || 'local');
  const [port, setPort] = useState(localStorage.getItem('facs_port') || '5000');
  const [isSettingsOpen, setIsSettingsOpen] = useState(!localStorage.getItem('facs_api_url'));
  const [tempApiUrl, setTempApiUrl] = useState(localStorage.getItem('facs_api_url') || '');

  const imageRef = useRef(null);
  const containerRef = useRef(null);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setImageDimensions({ width: img.width, height: img.height });
          setImage(e.target.result);
          setBoundingBox(null);
          setResults(null);
          setError('');
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMouseDown = useCallback((e) => {
    if (!image || !boundingBox) return;
    setIsDragging(true);
    const rect = imageRef.current.getBoundingClientRect();
    setDragStart({
      x: e.clientX - rect.left - boundingBox.x,
      y: e.clientY - rect.top - boundingBox.y
    });
  }, [boundingBox, image]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !image || !boundingBox) return;
    const rect = imageRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(e.clientX - rect.left - dragStart.x, imageDimensions.width - boundingBox.width));
    const newY = Math.max(0, Math.min(e.clientY - rect.top - dragStart.y, imageDimensions.height - boundingBox.height));
    setBoundingBox(prev => ({ ...prev, x: newX, y: newY }));
  }, [isDragging, dragStart, imageDimensions, boundingBox, image]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleResizeMouseDown = (e) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({ x: e.clientX, y: e.clientY });
  };

  const handleResizeMouseMove = useCallback((e) => {
    if (!isResizing) return;
    const dx = e.clientX - resizeStart.x;
    const dy = e.clientY - resizeStart.y;
    setBoundingBox(prev => ({
      ...prev,
      width: Math.max(20, prev.width + dx),
      height: Math.max(20, prev.height + dy)
    }));
    setResizeStart({ x: e.clientX, y: e.clientY });
  }, [isResizing, resizeStart]);

  const handleResizeMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMouseMove);
      document.addEventListener('mouseup', handleResizeMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleResizeMouseMove);
        document.removeEventListener('mouseup', handleResizeMouseUp);
      };
    }
  }, [isResizing, handleResizeMouseMove, handleResizeMouseUp]);

  const submitAnnotation = async () => {
    if (!image || !boundingBox) return;
    setIsSubmitting(true);
    if (!apiUrl) {
      setError('Please set the API URL in settings first.');
      setIsSettingsOpen(true);
      setIsSubmitting(false);
      return;
    }
    setError('');
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const annotationData = {
        image: image,
        coordinates: {
          x: Math.round(boundingBox.x),
          y: Math.round(boundingBox.y),
          width: boundingBox.width,
          height: boundingBox.height
        },
        category: category,
        view: view,
        source: "pc"
      };
      const cleanUrl = apiUrl.replace(/\/$/, '');
      const isNgrok = cleanUrl.includes('ngrok');
      const isHuggingFace = cleanUrl.includes('hf.space') || cleanUrl.includes('huggingface.co');
      const extraHeaders = {};
      if (isNgrok) extraHeaders['ngrok-skip-browser-warning'] = 'true';
      if (isHuggingFace) extraHeaders['X-Requested-With'] = 'XMLHttpRequest';
      const response = await fetch(`${cleanUrl}/api/process-annotation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(annotationData)
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      setActiveTab('results');
      setResults(result);
    } catch (err) {
      setError(`Failed to process annotation: ${err.message}`);
      console.error('Submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearImage = () => {
    setImage(null);
    setImageDimensions({ width: 0, height: 0 });
    setBoundingBox(null);
    setResults(null);
    setError('');
  };

  const clearBox = () => setBoundingBox(null);

  const addBox = () => {
    if (!image) return;
    setBoundingBox({ x: 225, y: 309, width: 287, height: 280 });
  };

  const clearResults = () => {
    setResults(null);
    setError('');
  };

  const saveApiUrl = () => {
    let finalUrl = '';
    if (connectionType === 'local') {
      finalUrl = `http://localhost:${port.trim()}`;
    } else {
      finalUrl = tempApiUrl.trim();
      if (finalUrl && !finalUrl.startsWith('http')) {
        finalUrl = 'https://' + finalUrl;
      }
    }
    if (!finalUrl && connectionType === 'hosted') return;

    setApiUrl(finalUrl);
    localStorage.setItem('facs_api_url', finalUrl);
    localStorage.setItem('facs_conn_type', connectionType);
    localStorage.setItem('facs_port', port);
    setIsSettingsOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="bg-gray-800 border-b border-gray-700 p-4 shadow-sm flex justify-between items-center">
        <div className="w-10"></div>
        <h1 className="text-2xl font-bold text-center text-gray-100">FACS - Fetal anomaly classifier</h1>
        <button 
          onClick={() => {
            setTempApiUrl(apiUrl);
            setPort(localStorage.getItem('facs_port') || '5000');
            setConnectionType(localStorage.getItem('facs_conn_type') || 'local');
            setIsSettingsOpen(true);
          }}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Settings"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>
      
      <div className="bg-gray-800 border-b border-gray-700 shadow-sm">
        <div className="flex">
          <button
            onClick={() => setActiveTab('annotation')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'annotation'
                ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                : 'text-gray-300 hover:text-gray-100 hover:bg-gray-700'
            }`}
          >
            <Square className="inline-block w-4 h-4 mr-2" /> Annotation
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'results'
                ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                : 'text-gray-300 hover:text-gray-100 hover:bg-gray-700'
            }`}
          >
            <ImageIcon className="inline-block w-4 h-4 mr-2" /> Results
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex">
        {activeTab === 'annotation' ? (
          <>
            <div className="flex-1 p-6">
              <div className="bg-gray-800 rounded-lg border border-gray-700 h-full shadow-sm">
                {!image ? (
                  <div className="h-full flex items-center justify-center">
                    <label className="cursor-pointer bg-gray-700 hover:bg-gray-600 rounded-lg p-8 border-2 border-dashed border-gray-600 hover:border-gray-500">
                      <div className="text-center">
                        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-lg font-medium text-gray-200">Upload Image</p>
                        <p className="text-sm text-gray-400 mt-2">Click to select an image file</p>
                      </div>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                ) : (
                  <div className="p-4 h-full overflow-auto">
                    <div
                      ref={containerRef}
                      className="relative inline-block"
                      style={{ width: imageDimensions.width, height: imageDimensions.height }}
                    >
                      <img
                        ref={imageRef}
                        src={image}
                        alt="Annotation image"
                        className="block"
                        style={{ width: imageDimensions.width, height: imageDimensions.height }}
                        draggable={false}
                      />
                      {boundingBox && (
                        <div
                          className="absolute border-2 border-red-500 bg-red-500 bg-opacity-30 cursor-move"
                          style={{
                            left: boundingBox.x,
                            top: boundingBox.y,
                            width: boundingBox.width,
                            height: boundingBox.height,
                            backgroundColor: 'rgba(255, 0, 0, 0.1)'
                          }}
                          onMouseDown={handleMouseDown}
                        >
                          <div
                            onMouseDown={handleResizeMouseDown}
                            className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 cursor-se-resize"
                          ></div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="w-80 p-6 bg-gray-800 border-l border-gray-700">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-200">Image Information</h3>
                  <div className="bg-gray-700 rounded-lg p-4 space-y-3 border border-gray-600">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Width:</span>
                      <span className="font-mono text-gray-100">{imageDimensions.width}px</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Height:</span>
                      <span className="font-mono text-gray-100">{imageDimensions.height}px</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-200">Bounding Box</h3>
                  <div className="bg-gray-700 rounded-lg p-4 space-y-3 border border-gray-600">
                    {boundingBox ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-300">Top-Left:</span>
                          <span className="font-mono text-gray-100">({Math.round(boundingBox.x)}, {Math.round(boundingBox.y)})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">Bottom-Right:</span>
                          <span className="font-mono text-gray-100">({Math.round(boundingBox.x + boundingBox.width)}, {Math.round(boundingBox.y + boundingBox.height)})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">Width:</span>
                          <span className="font-mono text-gray-100">{boundingBox.width}px</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">Height:</span>
                          <span className="font-mono text-gray-100">{boundingBox.height}px</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">Area:</span>
                          <span className="font-mono text-gray-100">{boundingBox.height*boundingBox.width}px</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-400 text-center">No bounding box added</p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-200">View</h3>
                  <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <select
                      value={view}
                      onChange={(e) => setView(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 text-gray-100"
                    >
                      <option value="crl">CRL</option>
                      <option value="nt">NT</option>
                      <option value="test">TEST(testing)</option>
                    </select>
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-4 text-gray-200">Category</h3>
                  <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 text-gray-100"
                    >
                      <option value="abdomen">Abdomen</option>
                      <option value="body">Body</option>
                      <option value="diencephalon">Diencephalon</option>
                      <option value="gsac">Gestation sac</option>
                      <option value="head">Head</option>
                      <option value="lv">Lateral Ventricle</option>
                      <option value="mx">Maxilla</option>
                      <option value="mds">MDS Mandible</option>
                      <option value="mls">MLS Mandible</option>
                      <option value="nb">Nasal bone</option>
                      <option value="ntaps">NTAPS</option>
                      <option value="rbp">Rhombencephalon</option>
                      <option value="thorax">Thorax</option>
                      <option value="test">TEST(testing)</option>
                    </select>
                  </div>
                </div>
                {error && (
                  <div className="bg-red-900 border border-red-700 rounded-lg p-3">
                    <p className="text-red-200 text-sm">{error}</p>
                  </div>
                )}
                <div className="space-y-3">
                  <button
                    onClick={clearImage}
                    disabled={!image}
                    className="w-full bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg py-2 px-4 font-medium text-white flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Clear Image
                  </button>
                  <button
                    onClick={addBox}
                    disabled={!image || boundingBox !== null}
                    className="w-full bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg py-2 px-4 font-medium text-white flex items-center justify-center"
                  >
                    <Square className="w-4 h-4 mr-2" /> Add Box
                  </button>
                  <button
                    onClick={clearBox}
                    disabled={!image || !boundingBox}
                    className="w-full bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg py-2 px-4 font-medium text-white flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Clear Box
                  </button>
                  <button
                    onClick={submitAnnotation}
                    disabled={!image || !boundingBox || isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg py-2 px-4 font-medium text-white flex items-center justify-center"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> Processing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" /> Submit Annotation
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 p-6">
            <div className="bg-gray-800 rounded-lg border border-gray-700 h-full shadow-sm">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-100">Results</h3>
                  <button
                    onClick={clearResults}
                    className="bg-blue-600 hover:bg-blue-700 transition-colors rounded-lg py-2 px-4 font-medium text-white flex items-center"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear Results
                  </button>
                </div>
                
                {!results && !error ? (
                  <div className="text-center py-12">
                    <ImageIcon className="mx-auto h-16 w-16 text-gray-500 mb-4" />
                    <p className="text-gray-300 text-lg">No results yet</p>
                    <p className="text-gray-400 text-sm mt-2">Submit an annotation to see processing results</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {error && (
                      <div className="bg-red-900 border border-red-700 rounded-lg p-4">
                        <h4 className="font-medium text-red-200 mb-2">Error</h4>
                        <p className="text-red-300">{error}</p>
                      </div>
                    )}
                    
                    {results && (
                      <div className="space-y-6">
                        {results.processed_image && (
                          <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                            <h4 className="font-medium text-gray-200 mb-3">Processed Image</h4>
                            <div className="border border-gray-600 rounded-lg overflow-hidden">
                              <img
                                src={results.processed_image}
                                alt="Processed result"
                                className="w-80 h-auto mx-auto"
                              />
                            </div>
                          </div>
                        )}
                        <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                          <h4 className="font-medium text-gray-200 mb-2">Anantomical structure</h4>
                          <p className="text-gray-300 capitalize">{results.category}</p>
                        </div>

                        {results.error && (
                          <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                            <h4 className="font-medium text-red-200 mb-2">Reconstruction error (Threshold={results.threshold})</h4>
                            <p className="text-red-300">{(results.error).toFixed(5)}</p>
                          </div>
                        )}
                        
                        {results.comment && (
                          <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                            <h4 className="font-medium text-blue-200 mb-2">Comment</h4>
                            <p className="text-blue-300">{results.comment}</p>
                          </div>
                        )}

                        {results.confidence && (
                          <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                            <h4 className="font-medium text-green-200 mb-2">Confidence Score</h4>
                            <p className="text-green-300">{(results.confidence).toFixed(4)}%</p>
                          </div>
                        )}
                        
                        {results.diagnosis && (
                          <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                            <h4 className="font-medium text-green-200 mb-2">Diagnosis</h4>
                            <p className="text-green-300">{results.diagnosis}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center mb-4">
              <div className="bg-blue-600 p-2 rounded-lg mr-3">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Server Connection</h2>
            </div>
            
            <p className="text-gray-400 mb-6 text-sm">
              Choose how to connect to the FACS backend processing server.
            </p>
            
            <div className="space-y-6">
              <div className="flex p-1 bg-gray-900 rounded-lg border border-gray-700">
                <button
                  onClick={() => setConnectionType('local')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    connectionType === 'local' 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Local Server
                </button>
                <button
                  onClick={() => setConnectionType('hosted')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    connectionType === 'hosted' 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Hosted / Remote
                </button>
              </div>

              {connectionType === 'local' ? (
                <div className="animate-in slide-in-from-left-2 duration-200">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Local Port
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500 font-mono">http://localhost:</span>
                    <input
                      type="text"
                      placeholder="5000"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white outline-none transition-all font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="animate-in slide-in-from-right-2 duration-200">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Remote Server URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://your-ngrok-url.ngrok-free.app or https://user-space.hf.space"
                    value={tempApiUrl}
                    onChange={(e) => setTempApiUrl(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white outline-none transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Supports: <span className="text-gray-400">Ngrok</span> · <span className="text-gray-400">HuggingFace Spaces</span> · <span className="text-gray-400">Any HTTPS endpoint</span>
                  </p>
                </div>
              )}
              
              <div className="flex space-x-3 pt-2">
                {apiUrl && (
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setConnectionType(localStorage.getItem('facs_conn_type') || 'local');
                      setPort(localStorage.getItem('facs_port') || '5000');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={saveApiUrl}
                  disabled={connectionType === 'local' ? !port.trim() : !tempApiUrl.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                >
                  Save Connection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FACS;