import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';

interface ProtocolConfig {
  id: string;
  name: string;
  label: string;
  desc: string;
  hex: string;
  schema: string;
}

interface ProtocolJson {
  id: string;
  name: string;
  label: string;
  desc: string;
  hex: string;
  schema: Array<{ name: string; bits: number; desc?: string }>;
}

const protocolModules = import.meta.glob('./protocols/*.json', { eager: true }) as Record<string, { default: ProtocolJson }>;

const BUILTIN_PROTOCOLS: ProtocolConfig[] = Object.values(protocolModules)
  .map((mod) => ({
    ...mod.default,
    schema: JSON.stringify(mod.default.schema, null, 2),
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

function loadCustomProtocols(): ProtocolConfig[] {
  try {
    const raw = localStorage.getItem('customProtocols');
    if (!raw) return [];
    const arr = JSON.parse(raw) as ProtocolJson[];
    return arr.map(p => ({ ...p, schema: JSON.stringify(p.schema, null, 2) }));
  } catch {
    return [];
  }
}

function loadCustomProtocolsJson(): ProtocolJson[] {
  try {
    const raw = localStorage.getItem('customProtocols');
    if (!raw) return [];
    return JSON.parse(raw) as ProtocolJson[];
  } catch {
    return [];
  }
}

function saveCustomProtocols(protocols: ProtocolJson[]) {
  localStorage.setItem('customProtocols', JSON.stringify(protocols));
}

function getProtocolOrder(): string[] {
  try {
    const raw = localStorage.getItem('protocolOrder');
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function saveProtocolOrder(ids: string[]) {
  localStorage.setItem('protocolOrder', JSON.stringify(ids));
}

function getAllProtocols(): ProtocolConfig[] {
  const all = [...BUILTIN_PROTOCOLS, ...loadCustomProtocols()];
  const order = getProtocolOrder();
  if (order.length === 0) return all.sort((a, b) => a.id.localeCompare(b.id));
  const ordered: ProtocolConfig[] = [];
  const remaining: ProtocolConfig[] = [];
  const idSet = new Set(all.map(p => p.id));
  for (const id of order) {
    if (idSet.has(id)) {
      const p = all.find(pp => pp.id === id);
      if (p) ordered.push(p);
    }
  }
  const orderedSet = new Set(ordered.map(p => p.id));
  for (const p of all) {
    if (!orderedSet.has(p.id)) remaining.push(p);
  }
  remaining.sort((a, b) => a.id.localeCompare(b.id));
  return [...ordered, ...remaining];
}

const FIELD_COLORS = [
  '#6366f1', '#06b6d4', '#a855f7', '#ec4899',
  '#f97316', '#22c55e', '#14b8a6', '#eab308',
  '#ef4444', '#3b82f6', '#8b5cf6', '#f43f5e',
];

const hexToBinString = (hex: string) => {
  let binStr = '';
  for (let i = 0; i < hex.length; i++) {
    const val = parseInt(hex[i], 16);
    if (isNaN(val)) continue;
    binStr += val.toString(2).padStart(4, '0');
  }
  return binStr;
};

const cleanHex = (raw: string) => raw.replace(/0x/gi, '').replace(/[^a-fA-F0-9]/g, '');

interface SchemaField {
  name: string;
  bits: number;
  desc?: string;
}

interface ParsedField extends SchemaField {
  binStr: string;
  dec: number | string;
  hex: string;
  colorIndex: number;
  offset: number;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      style={{
        background: copied ? 'rgba(34,197,94,0.1)' : 'var(--bg-input)',
        border: '1px solid',
        borderColor: copied ? 'rgba(34,197,94,0.3)' : 'var(--border)',
        cursor: 'pointer',
        color: copied ? 'var(--success)' : 'var(--text-muted)',
        fontSize: '11px',
        padding: '3px 8px',
        borderRadius: '6px',
        transition: 'all 0.2s',
        fontFamily: '"JetBrains Mono", monospace',
        fontWeight: 500,
      }}
      title="复制"
    >
      {copied ? '✓ 已复制' : '复制'}
    </button>
  );
}

const binStringToHex = (bin: string) => {
  const padded = bin.padStart(Math.ceil(bin.length / 4) * 4, '0');
  let hex = '';
  for (let i = 0; i < padded.length; i += 4) {
    hex += parseInt(padded.substring(i, i + 4), 2).toString(16).toUpperCase();
  }
  return hex;
};

function BitMap({ results, totalBits, onBitToggle }: { results: ParsedField[]; totalBits: number; onBitToggle: (bitIndex: number) => void }) {
  const binString = results.length > 0 && results[0].binStr !== 'N/A'
    ? results.map(f => f.binStr === 'N/A' ? '' : f.binStr).join('')
    : '';
  const displayBits = Math.max(totalBits, 32);
  const bitsPerRow = 32;
  const rows = Math.ceil(displayBits / bitsPerRow);

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '12px',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      boxShadow: 'var(--card-shadow)',
    }}>
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Bit 位分布图
          <span style={{ fontWeight: 400, fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px', textTransform: 'none', letterSpacing: '0' }}>点击可切换 0/1</span>
        </span>
      </div>
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '4px' }}>
          <span style={{ width: '32px', flexShrink: 0 }} />
          <div style={{ display: 'flex', flex: 1, gap: '4px' }}>
            {Array.from({ length: 4 }, (_, byteIdx) => (
              <div key={byteIdx} style={{ display: 'flex', flex: 1, gap: '1px' }}>
                {Array.from({ length: 8 }, (_, bitIdx) => {
                  const bitNum = 31 - (byteIdx * 8 + bitIdx);
                  return (
                    <span key={bitIdx} style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: '7px',
                      fontFamily: '"JetBrains Mono", monospace',
                      color: 'var(--text-muted)',
                      opacity: bitNum % 8 === 0 ? 0.7 : 0.3,
                      lineHeight: 1,
                    }}>
                      {bitNum}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {Array.from({ length: rows }, (_, rowIdx) => {
          const rowStartBit = rowIdx * bitsPerRow;
          return (
            <div key={rowIdx} style={{ marginBottom: rowIdx < rows - 1 ? '16px' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  width: '32px',
                  flexShrink: 0,
                  textAlign: 'center',
                  fontSize: '9px',
                  fontWeight: 500,
                  fontFamily: '"JetBrains Mono", monospace',
                  color: 'var(--text-muted)',
                  opacity: 0.6,
                }}>
                  W{rowIdx}
                </span>
                {Array.from({ length: 4 }, (_, byteIdx) => (
                  <div key={byteIdx} style={{ display: 'flex', flex: 1, gap: '1px' }}>
                    {Array.from({ length: 8 }, (_, bitIdx) => {
                      const globalBit = rowStartBit + byteIdx * 8 + bitIdx;
                      const field = results.find(f => globalBit >= f.offset && globalBit < f.offset + f.bits);
                      const color = field ? FIELD_COLORS[field.colorIndex % FIELD_COLORS.length] : 'var(--bg-input)';
                      const bitValue = globalBit < binString.length ? binString[globalBit] : null;

                      return (
                        <div
                          key={bitIdx}
                          onClick={() => {
                            if (field && bitValue !== null) {
                              onBitToggle(globalBit);
                            }
                          }}
                          style={{
                            flex: 1,
                            height: '28px',
                            background: field ? (bitValue === '1' ? color + '44' : color + '18') : 'var(--bg-input)',
                            border: `1px solid ${field ? color + '66' : 'var(--border)'}`,
                            borderRadius: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontFamily: '"JetBrains Mono", monospace',
                            color: field ? (bitValue === '1' ? color : color + '88') : 'var(--text-muted)',
                            fontWeight: 700,
                            cursor: field && bitValue !== null ? 'pointer' : 'default',
                            transition: 'background 0.15s, transform 0.1s',
                            userSelect: 'none',
                          }}
                          onMouseEnter={(e) => {
                            if (field && bitValue !== null) {
                              e.currentTarget.style.background = color + '55';
                              e.currentTarget.style.transform = 'scale(1.08)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (field && bitValue !== null) {
                              e.currentTarget.style.background = bitValue === '1' ? color + '44' : color + '18';
                              e.currentTarget.style.transform = 'scale(1)';
                            }
                          }}
                          title={field ? `${field.name} [${field.offset}:${field.offset + field.bits - 1}] = ${bitValue}` : `Bit ${globalBit}`}
                        >
                          {bitValue !== null ? bitValue : ''}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProtocolFormatView({ results, totalBits }: { results: ParsedField[]; totalBits: number }) {
  const displayBits = Math.max(totalBits, 32);
  const bitsPerRow = 32;
  const rows = Math.ceil(displayBits / bitsPerRow);
  const labelWidth = '32px';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '2px' }}>
        <span style={{ width: labelWidth, flexShrink: 0 }} />
        <div style={{ display: 'flex', flex: 1, gap: '0' }}>
          {Array.from({ length: 32 }, (_, i) => {
            const bitNum = 31 - i;
            return (
              <span key={i} style={{
                flex: 1,
                textAlign: 'center',
                fontSize: '8px',
                fontFamily: '"JetBrains Mono", monospace',
                color: 'var(--text-muted)',
                opacity: bitNum % 8 === 0 ? 0.7 : 0.35,
                lineHeight: 1,
              }}>
                {bitNum}
              </span>
            );
          })}
        </div>
      </div>

      {Array.from({ length: rows }, (_, rowIdx) => {
        const rowStartBit = rowIdx * bitsPerRow;
        const rowEndBit = Math.min(rowStartBit + bitsPerRow, displayBits);
        const rowFields = results.filter(f => f.offset + f.bits > rowStartBit && f.offset < rowEndBit);

        return (
          <div key={rowIdx} style={{ display: 'flex', alignItems: 'stretch', marginBottom: rowIdx < rows - 1 ? '12px' : 0 }}>
            <span style={{
              width: labelWidth,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9px',
              fontWeight: 500,
              fontFamily: '"JetBrains Mono", monospace',
              color: 'var(--text-muted)',
              opacity: 0.6,
            }}>
              W{rowIdx}
            </span>
            <div style={{ display: 'flex', flex: 1, alignItems: 'stretch', gap: '2px' }}>
              {rowFields.map((field, fi) => {
                const color = FIELD_COLORS[field.colorIndex % FIELD_COLORS.length];
                const fieldStartInRow = Math.max(field.offset - rowStartBit, 0);
                const fieldEndInRow = Math.min(field.offset + field.bits - rowStartBit, bitsPerRow);
                const fieldBitsInRow = fieldEndInRow - fieldStartInRow;
                const widthPercent = (fieldBitsInRow / bitsPerRow) * 100;

                return (
                  <div
                    key={fi}
                    style={{
                      width: `${widthPercent}%`,
                      minWidth: 0,
                      background: color + '22',
                      border: `1px solid ${color}55`,
                      borderRadius: '4px',
                      padding: '6px 4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '2px',
                    }}
                    title={`${field.name} [${field.offset}:${field.offset + field.bits - 1}] (${field.bits} bits)`}
                  >
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: color,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                      lineHeight: 1.2,
                    }}>
                      {field.name}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      fontFamily: '"JetBrains Mono", monospace',
                      lineHeight: 1.2,
                    }}>
                      {field.hex}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [protocols, setProtocols] = useState<ProtocolConfig[]>(() => getAllProtocols());
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const hexTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeProtocol, setActiveProtocol] = useState('oisa2');
  const [hexInput, setHexInput] = useState(() => getAllProtocols().find(p => p.id === 'oisa2')?.hex || '');
  const [schemaInput, setSchemaInput] = useState(() => {
    const proto = getAllProtocols().find(p => p.id === 'oisa2');
    if (!proto) return '';
    return JSON.stringify({
      id: proto.id,
      name: proto.name,
      label: proto.label,
      desc: proto.desc,
      hex: proto.hex,
      schema: JSON.parse(proto.schema),
    }, null, 2);
  });
  const [schemaView, setSchemaView] = useState<'json' | 'format'>('format');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleProtocolChange = (id: string) => {
    const proto = protocols.find(p => p.id === id);
    if (!proto) return;
    setActiveProtocol(id);
    setHexInput(proto.hex);
    const fullJson = {
      id: proto.id,
      name: proto.name,
      label: proto.label,
      desc: proto.desc,
      hex: proto.hex,
      schema: JSON.parse(proto.schema),
    };
    setSchemaInput(JSON.stringify(fullJson, null, 2));
  };

  const handleBitToggle = useCallback((bitIndex: number) => {
    const hex = cleanHex(hexInput);
    const binString = hexToBinString(hex);
    if (bitIndex >= binString.length) return;
    const chars = binString.split('');
    chars[bitIndex] = chars[bitIndex] === '1' ? '0' : '1';
    const newBin = chars.join('');
    const newHex = binStringToHex(newBin);
    setHexInput(newHex);
  }, [hexInput]);

  const handleFieldChange = useCallback((fieldOffset: number, fieldBits: number, newValue: number) => {
    const hex = cleanHex(hexInput);
    const binString = hexToBinString(hex);
    const maxVal = (1 << fieldBits) - 1;
    const clamped = Math.max(0, Math.min(newValue, maxVal));
    const fieldBin = clamped.toString(2).padStart(fieldBits, '0').slice(-fieldBits);
    const chars = binString.split('');
    for (let i = 0; i < fieldBits && (fieldOffset + i) < chars.length; i++) {
      chars[fieldOffset + i] = fieldBin[i];
    }
    const newBin = chars.join('');
    const newHex = binStringToHex(newBin);
    setHexInput(newHex);
  }, [hexInput]);

  const parsedData = useMemo(() => {
    let schema: SchemaField[] = [];

    try {
      const parsed = JSON.parse(schemaInput);
      if (Array.isArray(parsed)) {
        schema = parsed;
      } else if (parsed.schema && Array.isArray(parsed.schema)) {
        schema = parsed.schema;
      } else {
        throw new Error('需要包含 schema 数组字段');
      }
    } catch (e: any) {
      return { error: `JSON 格式错误: ${e.message}`, results: [] as ParsedField[], totalBits: 0 };
    }

    const hex = cleanHex(hexInput);
    const binString = hexToBinString(hex);
    let currentOffset = 0;
    const results: ParsedField[] = [];

    for (let i = 0; i < schema.length; i++) {
      const field = schema[i];
      if (!field.name || typeof field.bits !== 'number') {
        return { error: 'Schema 字段缺失 name 或 bits 属性', results: [] as ParsedField[], totalBits: 0 };
      }

      const endOffset = currentOffset + field.bits;

      if (endOffset > binString.length) {
        results.push({
          ...field,
          binStr: 'N/A',
          dec: '数据不足',
          hex: 'N/A',
          colorIndex: i,
          offset: currentOffset,
        });
        break;
      }

      const extractedBin = binString.substring(currentOffset, endOffset);
      const decValue = parseInt(extractedBin, 2);

      results.push({
        ...field,
        binStr: extractedBin,
        dec: decValue,
        hex: `0x${decValue.toString(16).toUpperCase()}`,
        colorIndex: i,
        offset: currentOffset,
      });

      currentOffset = endOffset;
    }

    return { error: null, results, totalBits: binString.length };
  }, [hexInput, schemaInput]);

  const lastStatsHexRef = useRef<string>('');
  useEffect(() => {
    if (parsedData.error === null && parsedData.results.length > 0 && hexInput !== lastStatsHexRef.current) {
      lastStatsHexRef.current = hexInput;
      const statsData = {
        protocol: activeProtocol,
        hexLength: cleanHex(hexInput).length,
        timestamp: new Date().toISOString(),
      };
      if ((window as any).electronAPI) {
        (window as any).electronAPI.parseStats(statsData);
      } else {
        fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(statsData),
        }).catch(() => {});
      }
    }
  }, [parsedData, hexInput, activeProtocol]);

  const totalSchemaBits = parsedData.results.reduce((sum, f) => sum + f.bits, 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <header style={{
        background: 'var(--header-gradient)',
        borderBottom: '1px solid var(--border)',
        padding: '20px 32px',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 800,
              color: 'white',
              boxShadow: '0 2px 8px var(--accent-glow)',
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              S
            </div>
            <div>
              <h1 style={{
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                letterSpacing: '-0.03em',
                lineHeight: 1.2,
              }}>
                ScaleUp Packet Parser
              </h1>
              <p style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                margin: 0,
                marginTop: '2px',
                fontWeight: 400,
                letterSpacing: '0.01em',
              }}>
                逐 Bit 报文结构解析工具
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              background: 'var(--bg-card)',
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}>
              {parsedData.totalBits} bits / {Math.ceil(parsedData.totalBits / 8)} bytes
            </div>
            <div
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: '13px', color: theme === 'dark' ? 'var(--text-muted)' : 'var(--accent)', transition: 'color 0.3s' }}>🌙</span>
              <div style={{
                width: '44px',
                height: '24px',
                borderRadius: '12px',
                background: theme === 'dark' ? 'var(--bg-input)' : 'var(--accent)',
                border: `1px solid ${theme === 'dark' ? 'var(--border)' : 'var(--accent)'}`,
                position: 'relative',
                transition: 'all 0.3s ease',
              }}>
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '9px',
                  background: theme === 'dark' ? 'var(--text-muted)' : '#fff',
                  position: 'absolute',
                  top: '2px',
                  left: theme === 'dark' ? '2px' : '22px',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
              <span style={{ fontSize: '13px', color: theme === 'light' ? 'var(--text-muted)' : 'var(--accent)', transition: 'color 0.3s' }}>☀️</span>
            </div>
          </div>
        </div>
      </header>

      {/* Protocol Navigation */}
      <nav style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 32px',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, overflowX: 'auto' }}>
            {protocols.map((proto, idx) => {
              const isActive = proto.id === activeProtocol;
              const isCustom = !BUILTIN_PROTOCOLS.some(bp => bp.id === proto.id);
              const isDragTarget = dragOverIdx === idx && dragIdx !== idx;
              return (
                <div
                  key={proto.id}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={() => {
                    if (dragIdx !== null && dragIdx !== idx) {
                      const newProtos = [...protocols];
                      const [moved] = newProtos.splice(dragIdx, 1);
                      newProtos.splice(idx, 0, moved);
                      setProtocols(newProtos);
                      saveProtocolOrder(newProtos.map(p => p.id));
                    }
                    setDragIdx(null);
                    setDragOverIdx(null);
                  }}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    opacity: dragIdx === idx ? 0.4 : 1,
                    borderLeft: isDragTarget ? '2px solid var(--accent)' : '2px solid transparent',
                    transition: 'opacity 0.2s, border-color 0.2s',
                    cursor: 'grab',
                  }}
                >
                  <button
                    onClick={() => handleProtocolChange(proto.id)}
                    style={{
                      background: isActive ? 'var(--accent-bg)' : 'transparent',
                      border: isActive ? '1px solid var(--accent)' + '44' : '1px solid transparent',
                      cursor: 'pointer',
                      padding: '7px 18px',
                      fontSize: '12px',
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? 'var(--accent-light)' : 'var(--text-muted)',
                      borderRadius: '8px',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.01em',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.color = 'var(--text-secondary)';
                        e.currentTarget.style.background = 'var(--bg-card)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }
                    }}
                  >
                    {proto.label}
                  </button>
                  {isCustom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`确定删除协议「${proto.label}」？`)) {
                          const customs = loadCustomProtocolsJson().filter(p => p.id !== proto.id);
                          saveCustomProtocols(customs);
                          setProtocols(getAllProtocols());
                          if (activeProtocol === proto.id) {
                            const first = getAllProtocols()[0];
                            if (first) handleProtocolChange(first.id);
                          }
                        }
                      }}
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '4px',
                        background: 'var(--error)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '14px',
                        height: '14px',
                        fontSize: '9px',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        padding: 0,
                        opacity: 0.7,
                        transition: 'opacity 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                      title="删除此协议"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--accent-light)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            border: '1px dashed var(--border)',
            borderRadius: '8px',
            marginLeft: '12px',
            transition: 'all 0.2s',
            letterSpacing: '0.01em',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.background = 'var(--accent-bg)';
            e.currentTarget.style.boxShadow = '0 0 12px var(--accent-glow)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.boxShadow = 'none';
          }}
          >
            + 导入协议
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try {
                    const data = JSON.parse(ev.target?.result as string) as ProtocolJson;
                    if (!data.id || !data.name || !data.schema || !Array.isArray(data.schema)) {
                      alert('JSON 格式不正确，需要包含 id, name, schema 字段');
                      return;
                    }
                    const existing = loadCustomProtocolsJson();
                    const builtinIds = BUILTIN_PROTOCOLS.map(p => p.id);
                    if (builtinIds.includes(data.id) || existing.some(p => p.id === data.id)) {
                      alert(`协议 ID「${data.id}」已存在，请修改 id 字段`);
                      return;
                    }
                    if (!data.hex) data.hex = '0'.repeat(Math.ceil(data.schema.reduce((s, f) => s + f.bits, 0) / 4));
                    if (!data.label) data.label = data.name;
                    if (!data.desc) data.desc = `${data.name} 协议报文格式`;
                    existing.push(data);
                    saveCustomProtocols(existing);
                    setProtocols(getAllProtocols());
                    handleProtocolChange(data.id);
                  } catch {
                    alert('JSON 解析失败，请检查文件格式');
                  }
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </nav>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px 32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              boxShadow: 'var(--card-shadow)',
            }}>
              <div style={{
                padding: '12px 18px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  HEX 报文输入
                </span>
                {cleanHex(hexInput) && (
                  <CopyButton text={cleanHex(hexInput)} />
                )}
              </div>
              <div style={{ padding: '14px 18px' }}>
                <div style={{
                  position: 'relative',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-focus)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: '36px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0,
                    pointerEvents: 'none',
                    zIndex: 1,
                    paddingTop: '8px',
                  }}>
                    {(() => {
                      const hex = cleanHex(hexInput);
                      const lineCount = Math.max(1, Math.ceil(hex.length / 8));
                      return Array.from({ length: lineCount }, (_, i) => (
                        <span key={i} style={{
                          fontSize: '9px',
                          fontWeight: 500,
                          fontFamily: '"JetBrains Mono", monospace',
                          color: 'var(--text-muted)',
                          opacity: 0.6,
                          height: '28.8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          W{i}
                        </span>
                      ));
                    })()}
                  </div>
                  <textarea
                    ref={hexTextareaRef}
                    value={cleanHex(hexInput).replace(/(.{8})/g, '$1\n').replace(/\n$/, '')}
                    onChange={(e) => {
                      const ta = e.target;
                      const cursorPos = ta.selectionStart;
                      const textBeforeCursor = ta.value.substring(0, cursorPos);
                      const newlinesBefore = (textBeforeCursor.match(/\n/g) || []).length;
                      const raw = ta.value.replace(/0x/gi, '').replace(/[^a-fA-F0-9]/g, '');
                      setHexInput(raw);
                      const newDisplay = raw.replace(/(.{8})/g, '$1\n').replace(/\n$/, '');
                      const targetPos = cursorPos - newlinesBefore;
                      const newNewlines = (newDisplay.substring(0, targetPos + (newDisplay.substring(0, targetPos).match(/\n/g) || []).length).match(/\n/g) || []).length;
                      requestAnimationFrame(() => {
                        if (hexTextareaRef.current) {
                          const pos = Math.min(targetPos + newNewlines, newDisplay.length);
                          hexTextareaRef.current.setSelectionRange(pos, pos);
                        }
                      });
                    }}
                    rows={Math.max(1, Math.ceil(cleanHex(hexInput).length / 8))}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      padding: '8px 14px 8px 36px',
                      color: 'var(--accent-light)',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '15px',
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                      outline: 'none',
                      resize: 'none',
                      lineHeight: '1.8',
                    }}
                    placeholder="输入 16 进制报文..."
                  />
                </div>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              boxShadow: 'var(--card-shadow)',
            }}>
              <div
                onClick={() => setSchemaView(v => v === 'json' ? 'format' : 'json')}
                style={{
                  padding: '12px 18px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {schemaView === 'json' ? '协议模板 (JSON Schema)' : '报文格式'}
                  <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px', textTransform: 'none', letterSpacing: '0' }}>
                    点击切换
                  </span>
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {parsedData.results.length} 字段 / {totalSchemaBits} bits
                </span>
              </div>
              {schemaView === 'json' ? (
                <div style={{ padding: '14px 18px' }}>
                  <textarea
                    value={schemaInput}
                    onChange={(e) => setSchemaInput(e.target.value)}
                    spellCheck={false}
                    style={{
                      width: '100%',
                      height: '200px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '14px',
                      color: 'var(--accent-light)',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '12px',
                      lineHeight: '1.6',
                      outline: 'none',
                      resize: 'vertical',
                      transition: 'all 0.2s',
                      fontWeight: 500,
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-focus)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                  />
                  {parsedData.error && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px 14px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      color: '#fca5a5',
                      fontSize: '12px',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}>
                      ⚠ {parsedData.error}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '14px 18px' }}>
                  {parsedData.error ? (
                    <div style={{
                      padding: '10px 14px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      color: '#fca5a5',
                      fontSize: '12px',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}>
                      ⚠ {parsedData.error}
                    </div>
                  ) : (
                    <ProtocolFormatView results={parsedData.results} totalBits={parsedData.totalBits} />
                  )}
                </div>
              )}
            </div>
          </div>

          {parsedData.results.length > 0 && !parsedData.error && (
            <BitMap results={parsedData.results} totalBits={parsedData.totalBits} onBitToggle={handleBitToggle} />
          )}

          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            boxShadow: 'var(--card-shadow)',
          }}>
            <div style={{
              padding: '12px 18px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                解析结果
              </span>
              {parsedData.results.length > 0 && !parsedData.error && (
                <CopyButton
                  text={parsedData.results.map(r =>
                    `${r.name}: ${r.dec} (${r.hex})`
                  ).join('\n')}
                />
              )}
            </div>

            {parsedData.results.length > 0 && !parsedData.error ? (
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px',
              }}>
                <thead>
                  <tr>
                    {['字段', '位宽', '偏移', 'Binary', 'Dec', 'Hex', '描述'].map(h => (
                      <th key={h} style={{
                        padding: '10px 14px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--bg-secondary)',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.results.map((row, idx) => {
                    const color = FIELD_COLORS[row.colorIndex % FIELD_COLORS.length];
                    return (
                      <tr key={idx} style={{ transition: 'background 0.15s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '2px',
                              background: color,
                              flexShrink: 0,
                            }} />
                            <span style={{ fontWeight: 600, color }}>{row.name}</span>
                          </div>
                        </td>
                        <td style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '12px',
                        }}>
                          {row.bits}b
                        </td>
                        <td style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '12px',
                        }}>
                          [{row.offset}:{row.offset + row.bits - 1}]
                        </td>
                        <td style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--border)',
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '12px',
                          letterSpacing: '0.05em',
                        }}>
                          <span style={{
                            background: color + '1a',
                            color,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 500,
                          }}>
                            {row.binStr}
                          </span>
                        </td>
                        <td style={{
                          padding: '4px 6px',
                          borderBottom: '1px solid var(--border)',
                          fontFamily: '"JetBrains Mono", monospace',
                        }}>
                          <input
                            type="number"
                            value={typeof row.dec === 'number' ? row.dec : 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              handleFieldChange(row.offset, row.bits, val);
                            }}
                            style={{
                              width: '100%',
                              minWidth: '60px',
                              background: 'var(--bg-input)',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              padding: '5px 10px',
                              color: 'var(--text-primary)',
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: '12px',
                              fontWeight: 600,
                              outline: 'none',
                              transition: 'all 0.2s',
                            }}
                            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-focus)'}
                            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                          />
                        </td>
                        <td style={{
                          padding: '4px 6px',
                          borderBottom: '1px solid var(--border)',
                          fontFamily: '"JetBrains Mono", monospace',
                        }}>
                          <input
                            type="text"
                            value={row.hex}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^a-fA-F0-9]/g, '');
                              const val = parseInt(raw, 16) || 0;
                              handleFieldChange(row.offset, row.bits, val);
                            }}
                            style={{
                              width: '100%',
                              minWidth: '50px',
                              background: 'var(--bg-input)',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              padding: '5px 10px',
                              color: 'var(--accent-light)',
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: '12px',
                              fontWeight: 600,
                              outline: 'none',
                              transition: 'all 0.2s',
                            }}
                            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-focus)'}
                            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                          />
                        </td>
                        <td style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          fontSize: '12px',
                        }}>
                          {row.desc || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{
                padding: '60px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '14px',
              }}>
                {parsedData.error ? '请修正 Schema 错误后查看解析结果' : '输入报文和协议模板后查看解析结果'}
              </div>
            )}
          </div>

          {parsedData.results.length > 0 && !parsedData.error && (
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              boxShadow: 'var(--card-shadow)',
            }}>
              <div style={{
                padding: '12px 18px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  原始二进制流
                </span>
                <CopyButton text={hexToBinString(cleanHex(hexInput))} />
              </div>
              <div style={{ padding: '14px 18px' }}>
                <div style={{
                  background: '#0d0f18',
                  borderRadius: '8px',
                  padding: '14px',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '13px',
                  lineHeight: '2',
                  wordBreak: 'break-all',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1px',
                }}>
                  {(() => {
                    const hex = cleanHex(hexInput);
                    const binStr = hexToBinString(hex);
                    let offset = 0;
                    const spans: React.ReactNode[] = [];

                    for (const field of parsedData.results) {
                      if (field.binStr === 'N/A') break;
                      const color = FIELD_COLORS[field.colorIndex % FIELD_COLORS.length];
                      const fieldBin = binStr.substring(offset, offset + field.bits);

                      for (let i = 0; i < fieldBin.length; i++) {
                        spans.push(
                          <span
                            key={`${offset + i}`}
                            style={{
                              color,
                              background: color + '15',
                              padding: '0 1px',
                            }}
                          >
                            {fieldBin[i]}
                          </span>
                        );
                      }

                      offset += field.bits;

                      if (offset < binStr.length && offset % 8 === 0) {
                        spans.push(
                          <span key={`space-${offset}`} style={{ width: '6px' }} />
                        );
                      }
                    }

                    return spans;
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
