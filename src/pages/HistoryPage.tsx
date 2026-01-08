import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  SortingState,
  ColumnDef,
} from '@tanstack/react-table';
import { ShiftData } from '../types';
import { getShiftHistory, exportToCSV } from '../lib/storage';
import { getRecentSubmissions } from '../lib/supabase';

// Type definitions for Supabase response
interface WasteRecordResponse {
  id: number;
  waste_amount: number;
  waste_type: string;
  recorded_at?: string;
  created_at?: string;
}

interface DowntimeRecordResponse {
  id: number;
  downtime_minutes: number;
  downtime_reason: string;
  recorded_at?: string;
  created_at?: string;
}

interface SubmissionResponse {
  id: number;
  operator_name: string;
  machine: string;
  order_number: string;
  product: string;
  batch_number: string;
  shift: string;
  submission_date: string;
  total_waste?: number;
  total_downtime?: number;
  created_at: string;
  waste_records?: WasteRecordResponse[];
  downtime_records?: DowntimeRecordResponse[];
}

const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<ShiftData[]>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'submittedAt', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [dataSource, setDataSource] = useState<'local' | 'database'>('database');
  const [isLoading, setIsLoading] = useState(false);

  // Transform Supabase submission to ShiftData
  const transformSubmission = useCallback((sub: SubmissionResponse): ShiftData => ({
    id: sub.id.toString(),
    operatorName: sub.operator_name,
    machine: sub.machine,
    orderNumber: sub.order_number,
    product: sub.product,
    batchNumber: sub.batch_number,
    shift: sub.shift,
    date: sub.submission_date,
    wasteEntries: (sub.waste_records || []).map((w: WasteRecordResponse) => ({
      id: w.id.toString(),
      waste: w.waste_amount,
      wasteType: w.waste_type,
      timestamp: new Date(w.recorded_at || w.created_at || Date.now()),
    })),
    downtimeEntries: (sub.downtime_records || []).map((d: DowntimeRecordResponse) => ({
      id: d.id.toString(),
      downtime: d.downtime_minutes,
      downtimeReason: d.downtime_reason,
      timestamp: new Date(d.recorded_at || d.created_at || Date.now()),
    })),
    totalWaste: sub.total_waste || 0,
    totalDowntime: sub.total_downtime || 0,
    submittedAt: new Date(sub.created_at),
  }), []);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    try {
      let history: ShiftData[] = [];

      if (dataSource === 'database') {
        // Fetch from Supabase
        const submissions = await getRecentSubmissions(100) as SubmissionResponse[];
        history = submissions.map(transformSubmission);
      } else {
        // Fetch from localStorage
        history = getShiftHistory();
      }

      const now = new Date();
      switch (dateRange) {
        case 'today':
          const todayStart = startOfDay(now);
          const todayEnd = endOfDay(now);
          history = history.filter(item => {
            const itemDate = new Date(item.submittedAt);
            return itemDate >= todayStart && itemDate <= todayEnd;
          });
          break;
        case 'week':
          const weekAgo = subDays(now, 7);
          history = history.filter(item => new Date(item.submittedAt) >= weekAgo);
          break;
        case 'month':
          const monthAgo = subDays(now, 30);
          history = history.filter(item => new Date(item.submittedAt) >= monthAgo);
          break;
      }

      setData(history);
    } catch (error) {
      console.error('Error loading data:', error);
      // Fallback to local storage if database fails
      if (dataSource === 'database') {
        setDataSource('local');
      }
    } finally {
      setIsLoading(false);
    }
  }, [dataSource, dateRange, transformSubmission]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const columns = useMemo<ColumnDef<ShiftData>[]>(() => [
    {
      accessorKey: 'date',
      header: 'Date',
      cell: info => format(new Date(info.getValue() as string), 'MMM dd, yyyy'),
    },
    {
      accessorKey: 'shift',
      header: 'Shift',
      cell: info => (
        <span className={`shift-tag ${(info.getValue() as string).toLowerCase()}`}>
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'operatorName',
      header: 'Operator',
    },
    {
      accessorKey: 'machine',
      header: 'Machine',
    },
    {
      accessorKey: 'orderNumber',
      header: 'Order',
    },
    {
      accessorKey: 'totalWaste',
      header: 'Waste (kg)',
      cell: info => (
        <span className="waste-value">{(info.getValue() as number).toFixed(1)}</span>
      ),
    },
    {
      accessorKey: 'totalDowntime',
      header: 'Downtime',
      cell: info => {
        const mins = info.getValue() as number;
        const hours = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        return (
          <span className="downtime-value">
            {hours > 0 ? `${hours}h ` : ''}{remainingMins}m
          </span>
        );
      },
    },
    {
      accessorKey: 'submittedAt',
      header: 'Submitted',
      cell: info => format(new Date(info.getValue() as Date), 'HH:mm'),
    },
  ], []);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const handleExport = () => {
    const filename = `shift_history_${format(new Date(), 'yyyy-MM-dd')}`;
    exportToCSV(data, filename);
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalWaste = data.reduce((sum, item) => sum + item.totalWaste, 0);
    const totalDowntime = data.reduce((sum, item) => sum + item.totalDowntime, 0);
    const avgWaste = data.length > 0 ? totalWaste / data.length : 0;
    const avgDowntime = data.length > 0 ? totalDowntime / data.length : 0;
    
    return { totalWaste, totalDowntime, avgWaste, avgDowntime, count: data.length };
  }, [data]);

  return (
    <motion.div
      className="history-page-v2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <header className="history-header-v2">
        <div className="header-left-v2">
          <button className="back-btn-v2" onClick={() => navigate('/')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <div className="header-titles">
            <h1>Submission History</h1>
            <span className="header-subtitle">
              {isLoading ? 'Loading...' : `${data.length} records from ${dataSource === 'database' ? 'Supabase' : 'Local Storage'}`}
            </span>
          </div>
        </div>
        <div className="header-actions-v2">
          <button 
            className="export-btn-v2" 
            onClick={handleExport} 
            disabled={data.length === 0}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </header>

      <main className="history-main">
        {/* Filters */}
        <div className="history-filters-v2">
          <div className="filter-group-v2">
            <label>Data Source</label>
            <div className="filter-pills">
              <button
                className={`filter-pill ${dataSource === 'database' ? 'active' : ''}`}
                onClick={() => setDataSource('database')}
              >
                ☁️ Database
              </button>
              <button
                className={`filter-pill ${dataSource === 'local' ? 'active' : ''}`}
                onClick={() => setDataSource('local')}
              >
                💾 Local
              </button>
            </div>
          </div>
          <div className="filter-group-v2">
            <label>Time Period</label>
            <div className="filter-pills">
              {(['today', 'week', 'month', 'all'] as const).map(range => (
                <button
                  key={range}
                  className={`filter-pill ${dateRange === range ? 'active' : ''}`}
                  onClick={() => setDateRange(range)}
                >
                  {range === 'today' ? 'Today' : range === 'week' ? '7 Days' : range === 'month' ? '30 Days' : 'All Time'}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group-v2 search-group">
            <label>Search</label>
            <div className="search-input-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text"
                className="search-input-v2"
                placeholder="Search operator, machine, order..."
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="history-stats-v2">
          <div className="stat-card-v2">
            <span className="stat-value-v2">{stats.count}</span>
            <span className="stat-label-v2">Submissions</span>
          </div>
          <div className="stat-card-v2 waste">
            <span className="stat-value-v2">{stats.totalWaste.toFixed(1)}<small>kg</small></span>
            <span className="stat-label-v2">Total Waste</span>
          </div>
          <div className="stat-card-v2 downtime">
            <span className="stat-value-v2">{Math.floor(stats.totalDowntime / 60)}h {stats.totalDowntime % 60}m</span>
            <span className="stat-label-v2">Total Downtime</span>
          </div>
          <div className="stat-card-v2">
            <span className="stat-value-v2">{stats.avgWaste.toFixed(1)}<small>kg</small></span>
            <span className="stat-label-v2">Avg per Shift</span>
          </div>
        </div>

        {/* Data Table */}
        <div className="history-table-container-v2">
          {data.length === 0 ? (
            <div className="empty-state-v2">
              <div className="empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
              </div>
              <h3>No submissions found</h3>
              <p>There are no shift submissions for the selected time period.</p>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="history-table-v2">
                  <thead>
                    {table.getHeaderGroups().map(headerGroup => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map(header => (
                          <th
                            key={header.id}
                            onClick={header.column.getToggleSortingHandler()}
                            className={header.column.getCanSort() ? 'sortable' : ''}
                          >
                            <div className="th-content">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getIsSorted() && (
                                <span className="sort-indicator">
                                  {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {table.getRowModel().rows.map(row => (
                        <motion.tr
                          key={row.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                        >
                          {row.getVisibleCells().map(cell => (
                            <td key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="table-pagination-v2">
                <div className="pagination-info-v2">
                  Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
                  {Math.min(
                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                    data.length
                  )}{' '}
                  of {data.length} entries
                </div>
                <div className="pagination-controls-v2">
                  <button
                    className="page-btn"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    ← Previous
                  </button>
                  <span className="page-indicator-v2">
                    {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                  </span>
                  <button
                    className="page-btn"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </motion.div>
  );
};

export default HistoryPage;
