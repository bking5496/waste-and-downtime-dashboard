import React from 'react';
import { motion } from 'framer-motion';
import './DataGrid.css';

interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
}

interface DataGridProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  onRowClick?: (row: T) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
}

export function DataGrid<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  onRowClick,
  sortColumn,
  sortDirection,
  onSort,
  emptyMessage = 'No data available',
  loading = false,
  className = '',
}: DataGridProps<T>) {
  const renderCell = (row: T, column: Column<T>, index: number) => {
    if (column.render) {
      return column.render(row, index);
    }
    const value = row[column.key as keyof T];
    return value !== undefined && value !== null ? String(value) : '-';
  };

  return (
    <div className={`mc-grid-container ${className}`}>
      <div className="mc-grid-wrapper">
        <table className="mc-grid">
          <thead className="mc-grid__head">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`mc-grid__th ${column.sortable ? 'mc-grid__th--sortable' : ''} mc-grid__th--${column.align || 'left'}`}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && onSort?.(String(column.key))}
                >
                  <div className="mc-grid__th-content">
                    <span>{column.header}</span>
                    {column.sortable && sortColumn === column.key && (
                      <span className="mc-grid__sort-icon">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="mc-grid__body">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="mc-grid__loading">
                  <div className="mc-grid__loader">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="mc-grid__empty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <motion.tr
                  key={String(row[keyField])}
                  className={`mc-grid__row ${onRowClick ? 'mc-grid__row--clickable' : ''}`}
                  onClick={() => onRowClick?.(row)}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={`mc-grid__td mc-grid__td--${column.align || 'left'}`}
                    >
                      {renderCell(row, column, index)}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Pagination component
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="mc-pagination">
      <div className="mc-pagination__info">
        Showing {startItem} to {endItem} of {totalItems} entries
      </div>
      <div className="mc-pagination__controls">
        <button
          className="mc-pagination__btn"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          ← Previous
        </button>
        <span className="mc-pagination__page">
          {currentPage} / {totalPages}
        </span>
        <button
          className="mc-pagination__btn"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
};
