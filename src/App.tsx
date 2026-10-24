import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Table2,
  RefreshCw,
  Settings,
  Link,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Search,
  X,
  Database,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Eye,
  Filter,
} from 'lucide-react';

interface SheetData {
  headers: string[];
  rows: string[][];
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

function App() {
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [data, setData] = useState<SheetData | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const extractSheetId = (url: string): { id: string; sheet: string } => {
    // Try to extract from various URL formats
    const patterns = [
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
      /\/d\/([a-zA-Z0-9-_]+)/,
      /^([a-zA-Z0-9-_]+)$/,
    ];

    let id = '';
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        id = match[1];
        break;
      }
    }

    // Extract sheet name/gid from URL
    let sheet = '';
    const gidMatch = url.match(/[?&]gid=(\d+)/);
    const sheetMatch = url.match(/[?&]sheet=([^&]+)/);
    if (sheetMatch) {
      sheet = sheetMatch[1];
    }

    return { id, sheet };
  };

  const fetchData = useCallback(async () => {
    if (!sheetId) {
      setError('Please enter a valid spreadsheet URL or ID');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    setError('');

    try {
      // Using Google Visualization API for public spreadsheets
      let url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
      if (sheetName) {
        url += `&sheet=${encodeURIComponent(sheetName)}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch data (HTTP ${response.status}). Make sure the spreadsheet is publicly accessible.`);
      }

      const text = await response.text();
      // Google returns JSONP-like response, need to extract JSON
      const jsonStr = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
      if (!jsonStr || !jsonStr[1]) {
        throw new Error('Failed to parse spreadsheet data. Make sure the spreadsheet is public.');
      }

      const jsonData = JSON.parse(jsonStr[1]);

      if (jsonData.status === 'error') {
        throw new Error(jsonData.errors?.[0]?.message || 'Unknown error from Google Sheets');
      }

      const table = jsonData.table;
      const headers = table.cols.map((col: any) => col.label || '');
      const rows = table.rows.map((row: any) =>
        row.c.map((cell: any) => {
          if (!cell) return '';
          if (cell.f) return cell.f; // formatted value
          return cell.v !== null && cell.v !== undefined ? String(cell.v) : '';
        })
      );

      setData({ headers, rows });
      setStatus('connected');
      setIsConnected(true);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to connect to spreadsheet');
      setStatus('error');
      setIsConnected(false);
    }
  }, [sheetId, sheetName]);

  useEffect(() => {
    if (autoRefresh && isConnected && sheetId) {
      intervalRef.current = setInterval(fetchData, refreshInterval * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, isConnected, sheetId, fetchData]);

  const handleConnect = () => {
    const { id, sheet } = extractSheetId(spreadsheetUrl);
    if (!id) {
      setError('Invalid spreadsheet URL or ID');
      setStatus('error');
      return;
    }
    setSheetId(id);
    setSheetName(sheet);
    setShowUrlInput(false);
    fetchData();
  };

  const handleDisconnect = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsConnected(false);
    setStatus('disconnected');
    setData(null);
    setShowUrlInput(true);
    setSheetId('');
    setSheetName('');
    setSpreadsheetUrl('');
    setError('');
    setLastUpdated(null);
  };

  const filteredRows = data?.rows.filter((row) => {
    if (!searchQuery) return true;
    return row.some((cell) =>
      cell.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const exportToCSV = () => {
    if (!data) return;
    const csvContent = [
      data.headers.join(','),
      ...(filteredRows || data.rows).map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sheet-data-${Date.now()}.csv`;
    link.click();
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-emerald-400';
      case 'connecting':
        return 'text-amber-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <Wifi className="w-4 h-4" />;
      case 'connecting':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'error':
        return <WifiOff className="w-4 h-4" />;
      default:
        return <WifiOff className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  Sheets Live Viewer
                </h1>
                <p className="text-xs text-slate-400">Real-time Google Sheets data</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Status Indicator */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/50 ${getStatusColor()}`}>
                {getStatusIcon()}
                <span className="text-xs font-medium capitalize">{status}</span>
              </div>

              {/* Settings Button */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700/80 transition-colors"
              >
                <Settings className="w-4 h-4 text-slate-300" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-400">Auto-refresh</label>
                    <button
                      onClick={() => setAutoRefresh(!autoRefresh)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        autoRefresh ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          autoRefresh ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-400">Refresh interval</label>
                    <select
                      value={refreshInterval}
                      onChange={(e) => setRefreshInterval(Number(e.target.value))}
                      className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      <option value={3}>3 seconds</option>
                      <option value={5}>5 seconds</option>
                      <option value={10}>10 seconds</option>
                      <option value={30}>30 seconds</option>
                      <option value={60}>1 minute</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Connection Panel */}
        {showUrlInput && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-4">
                <Link className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-semibold">Connect to Google Sheets</h2>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Enter the URL of a publicly accessible Google Spreadsheet. The spreadsheet must be shared with "Anyone with the link" permission.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={spreadsheetUrl}
                    onChange={(e) => setSpreadsheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                  />
                </div>
                <button
                  onClick={handleConnect}
                  disabled={!spreadsheetUrl.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed rounded-lg font-medium transition-all shadow-lg shadow-emerald-500/20 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Connect
                </button>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-4 flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Demo Link */}
              <div className="mt-4 p-3 bg-slate-900/30 rounded-lg border border-slate-700/30">
                <p className="text-xs text-slate-500 mb-2">💡 Tip: You can use this demo spreadsheet to test:</p>
                <button
                  onClick={() => setSpreadsheetUrl('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit')}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors underline"
                >
                  Use demo spreadsheet (Google sample data)
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Data View */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Table2 className="w-5 h-5 text-emerald-400" />
                  <span className="font-semibold text-lg">
                    {filteredRows?.length || 0} rows
                  </span>
                  <span className="text-slate-500">×</span>
                  <span className="text-slate-400">{data.headers.length} columns</span>
                </div>
                {lastUpdated && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full sm:w-64 bg-slate-800/50 border border-slate-700/50 rounded-lg pl-9 pr-9 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Refresh */}
                <button
                  onClick={fetchData}
                  disabled={status === 'connecting'}
                  className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors disabled:opacity-50"
                  title="Refresh data"
                >
                  <RefreshCw className={`w-4 h-4 text-slate-300 ${status === 'connecting' ? 'animate-spin' : ''}`} />
                </button>

                {/* Export */}
                <button
                  onClick={exportToCSV}
                  className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors"
                  title="Export as CSV"
                >
                  <Download className="w-4 h-4 text-slate-300" />
                </button>

                {/* Disconnect */}
                <button
                  onClick={handleDisconnect}
                  className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                  title="Disconnect"
                >
                  <X className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900/50 border-b border-slate-700/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-12">
                        #
                      </th>
                      {data.headers.map((header, idx) => (
                        <th
                          key={idx}
                          className="px-4 py-3 text-left text-xs font-semibold text-emerald-400 uppercase tracking-wider whitespace-nowrap"
                        >
                          {header || `Column ${idx + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {(filteredRows || data.rows).map((row, rowIdx) => (
                      <motion.tr
                        key={rowIdx}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(rowIdx * 0.02, 0.5) }}
                        className="hover:bg-slate-700/20 transition-colors"
                      >
                        <td className="px-4 py-2.5 text-xs text-slate-500 font-mono">
                          {rowIdx + 1}
                        </td>
                        {row.map((cell, cellIdx) => (
                          <td
                            key={cellIdx}
                            className="px-4 py-2.5 text-sm text-slate-300 whitespace-nowrap max-w-xs truncate"
                            title={cell}
                          >
                            {cell || <span className="text-slate-600">—</span>}
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Empty state */}
              {(!filteredRows || filteredRows.length === 0) && (
                <div className="py-12 text-center">
                  <Filter className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No matching rows found</p>
                </div>
              )}
            </div>

            {/* Footer info */}
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-4">
                {autoRefresh && isConnected && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    Auto-refreshing every {refreshInterval}s
                  </span>
                )}
              </div>
              <span>Spreadsheet ID: {sheetId.substring(0, 12)}...</span>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!data && !showUrlInput && status === 'connecting' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
            <p className="text-slate-400">Connecting to spreadsheet...</p>
          </motion.div>
        )}

        {/* Welcome State */}
        {!data && showUrlInput && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center py-16"
          >
            <div className="inline-flex p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-2xl border border-emerald-500/20 mb-6">
              <Database className="w-12 h-12 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to Sheets Live Viewer</h2>
            <p className="text-slate-400 max-w-md mx-auto">
              Connect to any public Google Spreadsheet to view its data in real-time. 
              Changes in the spreadsheet will automatically reflect here.
            </p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Link className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-sm font-medium text-white mb-1">Easy Connect</h3>
                <p className="text-xs text-slate-500">Paste any public sheet URL</p>
              </div>
              <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <RefreshCw className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-sm font-medium text-white mb-1">Real-time</h3>
                <p className="text-xs text-slate-500">Auto-refresh data</p>
              </div>
              <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-sm font-medium text-white mb-1">Export</h3>
                <p className="text-xs text-slate-500">Download as CSV</p>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default App;
