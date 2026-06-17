"use client";

import React, { useState, useEffect } from 'react';
import {
  ReactFlow,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Activity,
  Brain,
  Zap,
  CheckCircle2,
  Database,
  LineChart,
} from 'lucide-react';
import { motion } from 'motion/react';

/* ─────────────────────────────────────────────────────────────
   Custom Node — Minimalist Dark Theme
───────────────────────────────────────────────────────────── */
const CustomNode = ({ data }: any) => {
  const Icon = data.icon;

  const typeConfig: Record<string, { accent: string; bg: string }> = {
    trigger:   { accent: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    logic:     { accent: '#a3a3a3', bg: 'rgba(163,163,163,0.1)' },
    action:    { accent: '#a3a3a3', bg: 'rgba(163,163,163,0.1)' },
    condition: { accent: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  };
  const s = typeConfig[data.type] ?? typeConfig.action;

  return (
    <div style={{
      background: 'rgba(15, 15, 15, 0.9)',
      backdropFilter: 'blur(8px)',
      border: `1px solid rgba(255,255,255,0.08)`,
      borderRadius: 16,
      width: 260,
      padding: '16px 20px',
      boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px inset rgba(255,255,255,0.02)`,
      position: 'relative',
      transition: 'all 0.3s ease',
    }} className="hover:border-neutral-700">
      <Handle type="target" position={Position.Left} style={{ background: '#404040', width: 6, height: 6, border: 'none', left: -3 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ background: s.bg, borderRadius: 8, padding: 8, flexShrink: 0, border: `1px solid ${s.accent}20` }}>
          <Icon size={16} style={{ color: s.accent }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#737373', margin: 0, marginBottom: 2 }}>
            {data.type}
          </p>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#e5e5e5', margin: 0, lineHeight: 1.2 }}>
            {data.label}
          </p>
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#404040', width: 6, height: 6, border: 'none', right: -3 }} />
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

/* ─── AI Business Graph Data ───────────────────────────── */
const GAP_X = 380;

const INITIAL_NODES: Node[] = [
  { id: '1', type: 'custom', data: { label: 'Stripe Events', icon: Database,     type: 'trigger'   }, position: { x: 0,           y: 100 } },
  { id: '2', type: 'custom', data: { label: 'Analyze Churn Risk',   icon: Brain,        type: 'logic'     }, position: { x: GAP_X,       y: 100  } },
  { id: '3', type: 'custom', data: { label: 'Risk > 70%',      icon: Zap,          type: 'condition' }, position: { x: GAP_X * 2,   y: 100 } },
  { id: '4', type: 'custom', data: { label: 'Send Alert',       icon: LineChart,    type: 'action'    }, position: { x: GAP_X * 3,   y: 20  } },
  { id: '5', type: 'custom', data: { label: 'Update CRM',      icon: Activity,     type: 'action'    }, position: { x: GAP_X * 3,   y: 180 } },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true,  style: { stroke: '#525252', strokeWidth: 1.5 } },
  { id: 'e2-3', source: '2', target: '3', animated: true,  style: { stroke: '#525252', strokeWidth: 1.5 } },
  { id: 'e3-4', source: '3', target: '4', label: 'True', labelStyle: { fill: '#737373', fontSize: 11 }, style: { stroke: '#525252', strokeWidth: 1.5 }, labelBgStyle: { fill: 'transparent' } },
  { id: 'e3-5', source: '3', target: '5', label: 'False', labelStyle: { fill: '#737373', fontSize: 11 }, style: { stroke: '#525252', strokeWidth: 1.5 }, labelBgStyle: { fill: 'transparent' } },
];

/* ─── Main Component ───────────────────────────────────────── */
export default function WorkflowShowcase() {
  const [mounted, setMounted] = useState(false);
  const [nodes, , onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="py-24 relative overflow-hidden bg-black">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6 tracking-tight">
            Visual workflows for <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">complex operations</span>
          </h2>
          <p className="text-lg text-neutral-400">
            Build powerful automations without writing a single line of code. Connect your favorite apps and let Viona Pro handle the rest.
          </p>
        </motion.div>

        {/* Visual Flow Canvas Container */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="relative rounded-2xl border border-white/5 bg-neutral-900/20 backdrop-blur-md overflow-hidden h-[500px] shadow-[0_0_40px_rgba(16,185,129,0.1)]"
        >
          
          {/* Subtle Grid under the flow */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }} />

          {/* Mask to fade edges */}
          <div className="absolute inset-0 pointer-events-none z-10" style={{
            boxShadow: 'inset 0 0 100px 40px black'
          }} />

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.5}
            maxZoom={1.5}
            nodesDraggable={true}
            panOnDrag={true}
            zoomOnScroll={false}
            proOptions={{ hideAttribution: true }}
            style={{ background: 'transparent' }}
          />
        </motion.div>

      </div>
    </section>
  );
}