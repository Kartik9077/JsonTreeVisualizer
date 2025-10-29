import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
} from 'reactflow';
import { JSONPath } from 'jsonpath-plus';
import { toPng } from 'html-to-image';
import { 
  Moon, 
  Sun, 
  Trash2, 
  Download, 
  Search,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import 'reactflow/dist/style.css';
import './App.css';

const SAMPLE_JSON = {
  "user": {
    "name": "John Doe",
    "email": "john@example.com",
    "age": 30,
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "country": "USA"
    },
    "hobbies": ["reading", "coding", "gaming"]
  },
  "items": [
    { "id": 1, "name": "Laptop", "price": 999.99 },
    { "id": 2, "name": "Mouse", "price": 29.99 }
  ],
  "active": true,
  "metadata": null
};

const getNodeType = (value) => {
  if (value === null) return 'primitive';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'primitive';
};

const getNodeColor = (type, isDarkMode) => {
  const colors = {
    object: isDarkMode ? '#6366f1' : '#818cf8',
    array: isDarkMode ? '#10b981' : '#34d399',
    primitive: isDarkMode ? '#f59e0b' : '#fbbf24',
  };
  return colors[type];
};

const createNodesAndEdges = (json, isDarkMode) => {
  const nodes = [];
  const edges = [];
  let nodeId = 0;

  const traverse = (obj, parentId = null, key = 'root', level = 0) => {
    const currentId = `node-${nodeId++}`;
    const type = getNodeType(obj);
    const color = getNodeColor(type, isDarkMode);

    let label = '';
    let jsonPath = parentId ? `${nodes.find(n => n.id === parentId)?.data?.jsonPath || ''}` : '$';

    if (type === 'object') {
      label = key === 'root' ? '{}' : `{} ${key}`;
      jsonPath = key === 'root' ? '$' : `${jsonPath}.${key}`;
    } else if (type === 'array') {
      label = key === 'root' ? '[]' : `[] ${key}`;
      jsonPath = key === 'root' ? '$' : `${jsonPath}.${key}`;
    } else {
      const valueStr = obj === null ? 'null' : JSON.stringify(obj);
      label = `${key}: ${valueStr}`;
      jsonPath = typeof key === 'number' ? `${jsonPath}[${key}]` : `${jsonPath}.${key}`;
    }

    nodes.push({
      id: currentId,
      data: { 
        label,
        jsonPath,
        value: obj,
        nodeType: type
      },
      position: { x: 0, y: 0 },
      type: 'default',
      style: {
        background: color,
        color: '#fff',
        border: '2px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        padding: '10px 15px',
        fontSize: '13px',
        fontWeight: '500',
        minWidth: '120px',
        textAlign: 'center',
      },
    });

    if (parentId) {
      edges.push({
        id: `edge-${parentId}-${currentId}`,
        source: parentId,
        target: currentId,
        type: 'smoothstep',
        animated: false,
        style: { stroke: isDarkMode ? '#4b5563' : '#9ca3af', strokeWidth: 2 },
      });
    }

    if (type === 'object') {
      Object.entries(obj || {}).forEach(([childKey, childValue]) => {
        traverse(childValue, currentId, childKey, level + 1);
      });
    } else if (type === 'array') {
      obj.forEach((item, index) => {
        traverse(item, currentId, index, level + 1);
      });
    }
  };

  traverse(json);

  // Layout nodes in a tree structure
  const layoutNodes = (nodes, edges) => {
    const levelWidth = 300;
    const levelHeight = 120;
    const nodeLevels = {};

    // Calculate levels using BFS
    const calculateLevels = () => {
      const queue = [{ id: nodes[0].id, level: 0 }];
      const visited = new Set();

      while (queue.length > 0) {
        const { id, level } = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);

        if (!nodeLevels[level]) nodeLevels[level] = [];
        nodeLevels[level].push(id);

        edges
          .filter(e => e.source === id)
          .forEach(e => queue.push({ id: e.target, level: level + 1 }));
      }
    };

    calculateLevels();

    // Position nodes
    Object.keys(nodeLevels).forEach(level => {
      const nodesInLevel = nodeLevels[level];
      const levelNum = parseInt(level);
      const startX = -(nodesInLevel.length - 1) * levelWidth / 2;

      nodesInLevel.forEach((nodeId, index) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          node.position = {
            x: startX + index * levelWidth,
            y: levelNum * levelHeight,
          };
        }
      });
    });

    return nodes;
  };

  return {
    nodes: layoutNodes(nodes, edges),
    edges,
  };
};

function App() {
  const [jsonInput, setJsonInput] = useState(JSON.stringify(SAMPLE_JSON, null, 2));
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [error, setError] = useState('');
  const [searchPath, setSearchPath] = useState('');
  const [searchResult, setSearchResult] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  // const [hoveredNode, setHoveredNode] = useState(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const generateTree = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonInput);
      setError('');
      const { nodes: newNodes, edges: newEdges } = createNodesAndEdges(parsed, isDarkMode);
      setNodes(newNodes);
      setEdges(newEdges);
      setSearchResult('');
    } catch (err) {
      setError(`Invalid JSON: ${err.message}`);
    }
  }, [jsonInput, isDarkMode, setNodes, setEdges]);

  const handleSearch = useCallback(() => {
    if (!searchPath.trim()) {
      setSearchResult('');
      setNodes(nodes.map(node => ({
        ...node,
        style: {
          ...node.style,
          boxShadow: 'none',
          transform: 'scale(1)',
        },
      })));
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput);
      const results = JSONPath({ path: searchPath, json: parsed });

      if (results.length > 0) {
        setSearchResult(`Match found! (${results.length} result(s))`);
        
        const updatedNodes = nodes.map(node => {
          const nodePathMatches = results.some(result => {
            return JSON.stringify(node.data.value) === JSON.stringify(result);
          });

          if (nodePathMatches) {
            return {
              ...node,
              style: {
                ...node.style,
                boxShadow: '0 0 20px 5px rgba(255, 215, 0, 0.8)',
                transform: 'scale(1.1)',
                zIndex: 1000,
              },
            };
          }
          return {
            ...node,
            style: {
              ...node.style,
              boxShadow: 'none',
              transform: 'scale(1)',
            },
          };
        });

        setNodes(updatedNodes);

        // Pan to first matching node
        const matchingNode = updatedNodes.find(node => 
          results.some(result => JSON.stringify(node.data.value) === JSON.stringify(result))
        );

        if (matchingNode) {
          setTimeout(() => {
            const element = document.querySelector(`[data-id="${matchingNode.id}"]`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
        }
      } else {
        setSearchResult('No match found');
        setNodes(nodes.map(node => ({
          ...node,
          style: {
            ...node.style,
            boxShadow: 'none',
            transform: 'scale(1)',
          },
        })));
      }
    } catch (err) {
      setSearchResult(`Search error: ${err.message}`);
    }
  }, [searchPath, jsonInput, nodes, setNodes]);

  const handleClear = useCallback(() => {
    setJsonInput('');
    setNodes([]);
    setEdges([]);
    setError('');
    setSearchPath('');
    setSearchResult('');
  }, [setNodes, setEdges]);

  const handleDownload = useCallback(() => {
    const reactFlowElement = document.querySelector('.react-flow');
    if (reactFlowElement) {
      toPng(reactFlowElement, {
        backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
        width: reactFlowElement.offsetWidth,
        height: reactFlowElement.offsetHeight,
      })
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = 'json-tree.png';
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => {
          console.error('Failed to download image:', err);
        });
    }
  }, [isDarkMode]);

  const onNodeClick = useCallback((event, node) => {
    const path = node.data.jsonPath;
    navigator.clipboard.writeText(path).then(() => {
      alert(`Copied path: ${path}`);
    });
  }, []);

  return (
    <div className={`app-container ${isDarkMode ? 'dark' : ''}`}>
      <div className="sidebar">
        <div className="sidebar-header">
          <h1 data-testid="app-title">JSON Tree Visualizer</h1>
          <button
            data-testid="theme-toggle-button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="icon-button theme-toggle"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <div className="input-section">
          <label htmlFor="json-input" className="label">
            JSON Input
          </label>
          <textarea
            id="json-input"
            data-testid="json-input-textarea"
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder={`Enter JSON data...\n\nExample:\n${JSON.stringify({ user: { name: "John" } }, null, 2)}`}
            className="json-textarea"
          />
          {error && (
            <div className="error-message" data-testid="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="button-group">
          <button
            data-testid="generate-tree-button"
            onClick={generateTree}
            className="button primary"
          >
            Generate Tree
          </button>
          <button
            data-testid="clear-button"
            onClick={handleClear}
            className="button secondary"
          >
            <Trash2 size={16} />
            Clear
          </button>
        </div>

        <div className="search-section">
          <label htmlFor="search-input" className="label">
            Search JSON Path
          </label>
          <div className="search-input-group">
            <input
              id="search-input"
              data-testid="search-input"
              type="text"
              value={searchPath}
              onChange={(e) => setSearchPath(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g., $.user.address.city"
              className="search-input"
            />
            <button
              data-testid="search-button"
              onClick={handleSearch}
              className="icon-button search-button"
              title="Search"
            >
              <Search size={18} />
            </button>
          </div>
          {searchResult && (
            <div className={`search-result ${searchResult.includes('found!') ? 'success' : 'info'}`} data-testid="search-result">
              {searchResult.includes('found!') ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{searchResult}</span>
            </div>
          )}
        </div>

        <div className="info-section">
          <h3>Instructions:</h3>
          <ul>
            <li>Enter valid JSON in the textarea above</li>
            <li>Click "Generate Tree" to visualize</li>
            <li>Use JSON path syntax for search (e.g., $.user.name)</li>
            <li>Click any node to copy its path</li>
            <li>Use controls to zoom and pan</li>
            <li>Download tree as PNG image</li>
          </ul>
          <div className="legend">
            <h4>Node Types:</h4>
            <div className="legend-item">
              <span className="legend-color" style={{ background: getNodeColor('object', isDarkMode) }}></span>
              <span>Object</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ background: getNodeColor('array', isDarkMode) }}></span>
              <span>Array</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ background: getNodeColor('primitive', isDarkMode) }}></span>
              <span>Primitive</span>
            </div>
          </div>
        </div>
      </div>

      <div className="canvas-container" data-testid="canvas-container">
        {nodes.length > 0 ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            attributionPosition="bottom-left"
          >
            <Background color={isDarkMode ? '#374151' : '#e5e7eb'} gap={16} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                const type = node.data.nodeType;
                return getNodeColor(type, isDarkMode);
              }}
              maskColor={isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.1)'}
            />
            <Panel position="top-right">
              <button
                data-testid="download-button"
                onClick={handleDownload}
                className="icon-button download-button"
                title="Download as PNG"
              >
                <Download size={20} />
              </button>
            </Panel>
          </ReactFlow>
        ) : (
          <div className="empty-state" data-testid="empty-state">
            <div className="empty-state-content">
              <h2>No Tree Generated</h2>
              <p>Enter JSON data and click "Generate Tree" to visualize</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

