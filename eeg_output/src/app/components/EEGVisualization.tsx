import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { EEGChannelData } from '../types';

interface EEGVisualizationProps {
  isRecording: boolean;
  eegData?: EEGChannelData | null;
}

const CHANNELS = [
  { key: 'C3', color: '#06b6d4' },
  { key: 'Cz', color: '#10b981' },
  { key: 'C4', color: '#f59e0b' },
] as const;

const WINDOW_SIZE = 600;   // จำนวนจุดที่เห็นบนจอในแต่ละช่วง
const STEP_SIZE = 0.2;       // เลื่อนครั้งละกี่จุด

export function EEGVisualization({ isRecording, eegData }: EEGVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const playbackOffsetRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = 320 * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `320px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    const drawGrid = (width: number, height: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;

      for (let x = 0; x <= width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let y = 0; y <= height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.strokeStyle = '#d1d5db';
      for (let i = 1; i < 3; i++) {
        const y = (height / 3) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.fillStyle = '#6b7280';
      ctx.font = '12px sans-serif';
      ctx.fillText('C3', 8, 18);
      ctx.fillText('Cz', 8, height / 3 + 18);
      ctx.fillText('C4', 8, (height / 3) * 2 + 18);
    };

    const drawWindowedImportedData = (width: number, height: number) => {
      if (!eegData) return;

      const sourceChannels = [eegData.C3 || [], eegData.Cz || [], eegData.C4 || []];
      const maxLength = Math.max(...sourceChannels.map((c) => c.length), 0);
      if (maxLength < 2) return;

      let start = playbackOffsetRef.current;
      if (start >= maxLength) {
        start = 0;
        playbackOffsetRef.current = 0;
      }

      const end = Math.min(start + WINDOW_SIZE, maxLength);

      sourceChannels.forEach((rawPoints, channelIndex) => {
        const channelTop = (height / 3) * channelIndex;
        const channelHeight = height / 3;

        const points = rawPoints.slice(start, end);
        if (points.length < 2) return;

        const min = Math.min(...points);
        const max = Math.max(...points);
        const range = max - min || 1;

        ctx.strokeStyle = CHANNELS[channelIndex].color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < points.length; i++) {
          const x = (i / Math.max(points.length - 1, 1)) * width;
          const normalized = (points[i] - min) / range;
          const y =
            channelTop +
            channelHeight -
            normalized * (channelHeight - 24) -
            12;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.stroke();
      });

      playbackOffsetRef.current += STEP_SIZE;
      if (playbackOffsetRef.current >= maxLength - 1) {
        playbackOffsetRef.current = 0;
      }
    };

    const drawMockRecording = (width: number, height: number) => {
      CHANNELS.forEach((channel, channelIndex) => {
        const channelTop = (height / 3) * channelIndex;
        const channelHeight = height / 3;

        ctx.strokeStyle = channel.color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const points = 180;
        for (let i = 0; i < points; i++) {
          const x = (i / (points - 1)) * width;

          const t = (i + frame * 2) / 18;
          const noise =
            Math.sin(t) * 0.45 +
            Math.sin(t * 0.47) * 0.2 +
            Math.sin(t * 1.9) * 0.08;

          const centerY = channelTop + channelHeight / 2;
          const y = centerY - noise * (channelHeight * 0.28);

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.stroke();
      });
    };

    const drawIdleFlat = (width: number, height: number) => {
      CHANNELS.forEach((channel, channelIndex) => {
        const channelTop = (height / 3) * channelIndex;
        const centerY = channelTop + height / 6;

        ctx.strokeStyle = channel.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
      });
    };

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      drawGrid(width, height);

      const hasImportedData =
        !!eegData &&
        (!!eegData.C3?.length || !!eegData.Cz?.length || !!eegData.C4?.length);

      if (hasImportedData && isRecording) {
      drawWindowedImportedData(width, height);
      animationRef.current = requestAnimationFrame(render);
      } else if (isRecording) {
      drawMockRecording(width, height);
      frame += 1;
      animationRef.current = requestAnimationFrame(render);
      } else {
      drawIdleFlat(width, height);
      }
    };

    playbackOffsetRef.current = 0;
    resizeCanvas();
    render();

    const handleResize = () => {
      resizeCanvas();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, eegData]);

  const hasImportedData =
    !!eegData && (!!eegData.C3?.length || !!eegData.Cz?.length || !!eegData.C4?.length);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">EEG Signal Visualization</CardTitle>
          <div className="flex items-center gap-2">
            {hasImportedData ? (
              <Badge className="bg-cyan-100 text-cyan-700">Playback Mode</Badge>
            ) : isRecording ? (
              <Badge className="bg-green-100 text-green-700">Live Preview</Badge>
            ) : (
              <Badge variant="outline">Idle</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="w-full rounded-xl border bg-white p-3">
          <canvas ref={canvasRef} className="w-full h-[320px] rounded-md" />
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-cyan-500" />
            <span>C3</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" />
            <span>Cz</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />
            <span>C4</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}