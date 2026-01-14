import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

// Base skeleton component with shimmer animation
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  borderRadius = '4px',
  className = '',
}) => (
  <div
    className={`skeleton ${className}`}
    style={{
      width,
      height,
      borderRadius,
      background: 'linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1.5s infinite',
    }}
    aria-hidden="true"
  />
);

// Machine card skeleton for dashboard
export const MachineCardSkeleton: React.FC = () => (
  <motion.div
    className="machine-tile skeleton-card"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}
    aria-label="Loading machine"
  >
    <div className="tile-content">
      <div className="tile-header">
        <Skeleton width="60%" height="1.25rem" />
        <Skeleton width="12px" height="12px" borderRadius="50%" />
      </div>
      <Skeleton width="40%" height="0.875rem" className="mt-2" />
      <Skeleton width="70%" height="0.75rem" className="mt-3" />
      <div className="tile-footer mt-4">
        <Skeleton width="50%" height="0.75rem" />
      </div>
    </div>
  </motion.div>
);

// Dashboard stats skeleton
export const StatsSkeleton: React.FC = () => (
  <div className="stats-skeleton" aria-label="Loading statistics">
    <div className="efficiency-skeleton">
      <Skeleton width="120px" height="120px" borderRadius="50%" />
      <Skeleton width="80%" height="0.875rem" className="mt-2" />
    </div>
    <div className="quick-stats-skeleton">
      {[1, 2, 3].map((i) => (
        <div key={i} className="stat-item-skeleton">
          <Skeleton width="12px" height="12px" borderRadius="50%" />
          <div>
            <Skeleton width="2rem" height="1.5rem" />
            <Skeleton width="3rem" height="0.75rem" className="mt-1" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Chart skeleton
export const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 120 }) => (
  <div className="chart-skeleton" aria-label="Loading chart">
    <Skeleton width="50%" height="1rem" className="mb-2" />
    <Skeleton width="100%" height={height} borderRadius="8px" />
  </div>
);

// Form field skeleton
export const FormFieldSkeleton: React.FC = () => (
  <div className="form-field-skeleton" aria-label="Loading form field">
    <Skeleton width="30%" height="0.875rem" className="mb-1" />
    <Skeleton width="100%" height="2.5rem" borderRadius="6px" />
  </div>
);

// Table row skeleton
export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
  <tr className="table-row-skeleton" aria-label="Loading row">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i}>
        <Skeleton width={i === 0 ? '80%' : '60%'} height="1rem" />
      </td>
    ))}
  </tr>
);

// Full page loading skeleton
export const PageSkeleton: React.FC = () => (
  <div className="page-skeleton" role="status" aria-label="Loading page">
    <header className="header-skeleton">
      <Skeleton width="200px" height="2rem" />
      <div className="header-actions-skeleton">
        <Skeleton width="100px" height="2rem" borderRadius="6px" />
        <Skeleton width="100px" height="2rem" borderRadius="6px" />
      </div>
    </header>
    <main className="main-skeleton">
      <aside className="sidebar-skeleton">
        <StatsSkeleton />
        <ChartSkeleton />
      </aside>
      <section className="content-skeleton">
        <Skeleton width="200px" height="1.5rem" className="mb-4" />
        <div className="grid-skeleton">
          {Array.from({ length: 6 }).map((_, i) => (
            <MachineCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </main>
  </div>
);

// Entry list skeleton
export const EntryListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="entry-list-skeleton" aria-label="Loading entries">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="entry-skeleton">
        <Skeleton width="3rem" height="1.5rem" />
        <Skeleton width="40%" height="1rem" />
        <Skeleton width="4rem" height="0.875rem" />
      </div>
    ))}
  </div>
);

// Add CSS for skeleton animations
const skeletonStyles = `
@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.skeleton {
  display: block;
}

.skeleton-card {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 1rem;
}

.mt-1 { margin-top: 0.25rem; }
.mt-2 { margin-top: 0.5rem; }
.mt-3 { margin-top: 0.75rem; }
.mt-4 { margin-top: 1rem; }
.mb-1 { margin-bottom: 0.25rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-4 { margin-bottom: 1rem; }

.stats-skeleton,
.quick-stats-skeleton,
.stat-item-skeleton,
.entry-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.quick-stats-skeleton {
  margin-top: 1rem;
}

.stat-item-skeleton {
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
}

.entry-skeleton {
  flex-direction: row;
  align-items: center;
  padding: 0.75rem;
  background: rgba(30, 41, 59, 0.3);
  border-radius: 6px;
}

.grid-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.page-skeleton {
  min-height: 100vh;
  padding: 1rem;
  background: #0f172a;
}

.header-skeleton {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  margin-bottom: 1rem;
}

.header-actions-skeleton {
  display: flex;
  gap: 0.5rem;
}

.main-skeleton {
  display: flex;
  gap: 1rem;
}

.sidebar-skeleton {
  width: 280px;
  flex-shrink: 0;
}

.content-skeleton {
  flex: 1;
}
`;

// Inject skeleton styles
if (typeof document !== 'undefined') {
  const styleId = 'skeleton-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = skeletonStyles;
    document.head.appendChild(style);
  }
}

export default Skeleton;
