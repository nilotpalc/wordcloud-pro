/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import cloud from 'd3-cloud';
import nlp from 'compromise';
import { removeStopwords } from 'stopword';
import { Upload, FileText, RefreshCw, Download, Trash2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WordData {
  text: string;
  size: number;
}

export default function App() {
  console.log('App rendering');
  const [text, setText] = useState('');
  const [words, setWords] = useState<WordData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const processText = useCallback((rawText: string) => {
    if (!rawText.trim()) {
      setWords([]);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // 1. Use compromise to find and remove verbs
      const doc = nlp(rawText);
      doc.remove('#Verb');
      const textWithoutVerbs = doc.text();

      // 2. Tokenize and clean
      const tokens = textWithoutVerbs
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2);

      // 3. Remove stopwords
      const filteredWords = removeStopwords(tokens);

      // 4. Count frequencies
      const counts: Record<string, number> = {};
      filteredWords.forEach(word => {
        counts[word] = (counts[word] || 0) + 1;
      });

      // 5. Format for d3-cloud
      const wordData: WordData[] = Object.entries(counts)
        .map(([text, count]) => ({ text, size: count }))
        .sort((a, b) => b.size - a.size)
        .slice(0, 150); // Limit to top 150 words

      setWords(wordData);
    } catch (err) {
      console.error('Processing error:', err);
      setError('Failed to process text. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  useEffect(() => {
    if (words.length === 0 || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = 500;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const layout = cloud()
      .size([width, height])
      .words(words.map(d => ({ ...d, size: 10 + Math.sqrt(d.size) * 15 })))
      .padding(5)
      .rotate(() => (~~(Math.random() * 6) - 3) * 30)
      .font('Inter')
      .fontSize(d => (d as any).size)
      .on('end', draw);

    layout.start();

    function draw(words: any[]) {
      svg
        .attr('width', layout.size()[0])
        .attr('height', layout.size()[1])
        .append('g')
        .attr('transform', `translate(${layout.size()[0] / 2},${layout.size()[1] / 2})`)
        .selectAll('text')
        .data(words)
        .enter()
        .append('text')
        .style('font-size', d => `${d.size}px`)
        .style('font-family', 'Inter')
        .style('fill', () => d3.schemeTableau10[Math.floor(Math.random() * 10)])
        .attr('text-anchor', 'middle')
        .attr('transform', d => `translate(${[d.x, d.y]})rotate(${d.rotate})`)
        .text(d => d.text)
        .style('cursor', 'pointer')
        .on('mouseover', function() {
          d3.select(this).style('opacity', 0.7);
        })
        .on('mouseout', function() {
          d3.select(this).style('opacity', 1);
        });
    }
  }, [words]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setText(content);
      processText(content);
    };
    reader.readAsText(file);
  };

  const handleDownload = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    const svgSize = svgRef.current.getBoundingClientRect();
    canvas.width = svgSize.width;
    canvas.height = svgSize.height;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = 'wordcloud.png';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#141414] font-sans p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#141414] pb-6">
          <div>
            <h1 className="text-6xl font-bold tracking-tighter uppercase leading-none">
              WordCloud<span className="text-[#F27D26]">Pro</span>
            </h1>
            <p className="mt-2 text-sm font-mono opacity-60 uppercase tracking-widest">
              Visualizing Language / Removing Noise / Extracting Essence
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => processText(text)}
              className="flex items-center gap-2 px-4 py-2 border border-[#141414] hover:bg-[#141414] hover:text-[#F5F5F4] transition-colors uppercase text-xs font-bold tracking-widest"
            >
              <RefreshCw size={14} className={isProcessing ? 'animate-spin' : ''} />
              Regenerate
            </button>
            <button
              onClick={handleDownload}
              disabled={words.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-[#141414] text-[#F5F5F4] hover:bg-opacity-80 transition-colors uppercase text-xs font-bold tracking-widest disabled:opacity-30"
            >
              <Download size={14} />
              Export PNG
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Input Section */}
          <section className="lg:col-span-4 space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-serif italic opacity-50 uppercase tracking-widest">
                Source Text / Markdown
              </label>
              <div className="relative group">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your text here or upload a file..."
                  className="w-full h-80 p-4 bg-white border border-[#141414] focus:outline-none focus:ring-1 focus:ring-[#F27D26] resize-none font-mono text-sm"
                />
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <label className="cursor-pointer p-2 bg-[#141414] text-white hover:bg-[#F27D26] transition-colors rounded-full shadow-lg">
                    <Upload size={16} />
                    <input
                      type="file"
                      accept=".txt,.md"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                  <button
                    onClick={() => { setText(''); setWords([]); }}
                    className="p-2 bg-white border border-[#141414] hover:bg-red-50 transition-colors rounded-full shadow-lg"
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border border-[#141414] border-dashed bg-white/50 space-y-3">
              <div className="flex items-center gap-2 text-[#F27D26]">
                <Info size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Processing Logic</span>
              </div>
              <ul className="text-[11px] space-y-1 opacity-80">
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-[#141414] rounded-full" />
                  Automatic verb removal (NLP)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-[#141414] rounded-full" />
                  Standard stopword filtering
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-[#141414] rounded-full" />
                  Top 150 frequency extraction
                </li>
              </ul>
            </div>
          </section>

          {/* Visualization Section */}
          <section className="lg:col-span-8 bg-white border border-[#141414] relative overflow-hidden min-h-[500px] flex items-center justify-center" ref={containerRef}>
            <AnimatePresence mode="wait">
              {words.length > 0 ? (
                <motion.svg
                  key="cloud"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  ref={svgRef}
                  className="w-full h-full"
                />
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-4 text-center p-12"
                >
                  <FileText size={48} strokeWidth={1} className="opacity-20" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold uppercase tracking-widest opacity-40">Visualization Pending</p>
                    <p className="text-xs opacity-30 italic font-serif">Input text to generate your word cloud</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isProcessing && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="animate-spin text-[#F27D26]" size={32} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Analyzing Text...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                <Trash2 size={12} />
                {error}
              </div>
            )}
          </section>
        </main>

        {/* Footer Stats */}
        <footer className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-[#141414] opacity-50">
          <div className="space-y-1">
            <span className="text-[9px] uppercase tracking-tighter">Unique Words</span>
            <p className="text-2xl font-mono leading-none">{words.length}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] uppercase tracking-tighter">NLP Engine</span>
            <p className="text-2xl font-mono leading-none">Compromise</p>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] uppercase tracking-tighter">Rendering</span>
            <p className="text-2xl font-mono leading-none">D3-Cloud</p>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] uppercase tracking-tighter">Status</span>
            <p className="text-2xl font-mono leading-none">Ready</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
